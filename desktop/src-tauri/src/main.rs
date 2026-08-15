#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! XYZ-OS desktop shell.
//!
//! The shell is deliberately thin. On first launch it unpacks the bundled
//! engine runtime (one zstd-compressed tar shipped as a Tauri resource), then
//! spawns the bundled Node engine (`xyz-engine`) to serve the web UI on a free
//! loopback port and navigates the webview to the URL the engine announces on
//! stdout. Sessions, modes, models, and the UI stay in the engine, so the
//! desktop shell never duplicates product behavior.
//!
//! Dev mode (`tauri dev`) skips the bundled runtime and assumes a dev server
//! is already running on <http://127.0.0.1:3080>.

use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tar::Archive;
use tauri::{Manager, WindowEvent};
use zstd::stream::read::Decoder;

/// State holding the engine child so app exit can kill it.
struct Engine(Mutex<Option<Child>>);

/// Resource path of the bundled runtime archive.
const RUNTIME_ARCHIVE: &str = "runtime/runtime.tar.zst";

/// Directory inside the per-user app data dir that receives the runtime.
const RUNTIME_DIR: &str = "runtime";

/// Marker written after a complete extraction so later launches skip it.
const VERSION_MARKER: &str = ".xyz-version";

/// Directory beside the executable (bundled binaries and, in dev,
/// `target/debug` or `target/release`).
fn exe_dir() -> PathBuf {
    std::env::current_exe()
        .expect("exe path")
        .parent()
        .expect("exe parent")
        .to_path_buf()
}

/// Per-user location the bundled runtime unpacks into.
fn runtime_root(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("app data dir")
        .join(RUNTIME_DIR)
}

/// Location of the runtime archive inside the application resources.
fn runtime_archive(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .resolve(RUNTIME_ARCHIVE, tauri::path::BaseDirectory::Resource)
        .expect("runtime archive path")
}

/// Create a directory link pointing at `target`. Windows gets a junction
/// (unprivileged reparse point), Unix a symlink.
#[cfg(windows)]
fn create_dir_link(link: &Path, target: &Path) -> Result<(), String> {
    junction::create(target, link)
        .map_err(|error| format!("cannot create junction {}: {error}", link.display()))
}

#[cfg(not(windows))]
fn create_dir_link(link: &Path, target: &Path) -> Result<(), String> {
    std::os::unix::fs::symlink(target, link)
        .map_err(|error| format!("cannot create symlink {}: {error}", link.display()))
}

/// Unpack the bundled runtime unless the current app version is already
/// unpacked. pnpm's workspace links are recreated afterwards (junctions on
/// Windows, symlinks on Unix) without copying their content. Windows junctions
/// always store absolute paths, so extraction writes directly into the final
/// directory; a version marker written last marks the tree complete, and a
/// partial tree from an interrupted extraction is cleared on the next launch.
fn ensure_runtime(app: &tauri::AppHandle, version: &str) -> Result<PathBuf, String> {
    let root = runtime_root(app);
    let marker = root.join(VERSION_MARKER);
    if fs::read_to_string(&marker)
        .map(|stored| stored.trim() == version)
        .unwrap_or(false)
    {
        return Ok(root);
    }

    if root.exists() {
        fs::remove_dir_all(&root)
            .map_err(|error| format!("cannot clear old runtime: {error}"))?;
    }
    fs::create_dir_all(&root).map_err(|error| format!("cannot create runtime dir: {error}"))?;

    let archive = runtime_archive(app);
    let file = fs::File::open(&archive)
        .map_err(|error| format!("cannot open runtime archive {}: {error}", archive.display()))?;
    let decoder = Decoder::new(file)
        .map_err(|error| format!("cannot read runtime archive {}: {error}", archive.display()))?;
    let mut tar = Archive::new(decoder);
    tar.set_unpack_xattrs(false);
    // Executable bits matter on Unix (node-pty's spawn helper); Windows
    // ignores modes and a read-only tree would break future replacement.
    tar.set_preserve_permissions(cfg!(unix));
    tar.set_preserve_mtime(false);

    let unpack = (|| -> Result<Vec<(PathBuf, PathBuf)>, String> {
        let mut links = Vec::new();
        let entries = tar
            .entries()
            .map_err(|error| format!("corrupt runtime archive: {error}"))?;
        for entry in entries {
            let mut entry = entry.map_err(|error| format!("corrupt runtime archive: {error}"))?;
            let entry_type = entry.header().entry_type();
            let path = entry
                .path()
                .map_err(|error| format!("corrupt archive path: {error}"))?
                .into_owned();
            let unsafe_path = path.is_absolute()
                || path
                    .components()
                    .any(|component| matches!(component, Component::ParentDir));
            if unsafe_path {
                return Err(format!(
                    "unsafe path in runtime archive: {}",
                    path.display()
                ));
            }
            if entry_type.is_symlink() || entry_type.is_hard_link() {
                let target = entry
                    .link_name()
                    .map_err(|error| format!("corrupt link entry: {error}"))?
                    .ok_or_else(|| format!("link entry without a target: {}", path.display()))?;
                links.push((path, target.into_owned().into()));
                continue;
            }
            entry
                .unpack_in(&root)
                .map_err(|error| format!("cannot unpack {}: {error}", path.display()))?;
        }
        Ok(links)
    })();

    let links = match unpack {
        Ok(links) => links,
        Err(error) => {
            let _ = fs::remove_dir_all(&root);
            return Err(error);
        }
    };

    // Recreate links only after every regular entry exists, retrying so
    // link-to-link chains resolve. Directory links never require their target
    // to be materialized; cycles therefore terminate.
    let root_canonical = dunce::canonicalize(&root)
        .map_err(|error| format!("cannot canonicalize runtime dir: {error}"))?;
    let mut pending = links;
    let mut progress = true;
    while !pending.is_empty() && progress {
        progress = false;
        let mut remaining = Vec::new();
        for (path, target) in pending.drain(..) {
            let link_path = root.join(&path);
            let parent = link_path.parent().ok_or_else(|| {
                format!("link has no parent directory: {}", path.display())
            })?;
            let resolved = dunce::canonicalize(parent.join(&target));
            match resolved {
                Ok(target_abs)
                    if target_abs.starts_with(&root_canonical) && target_abs.exists() =>
                {
                    if target_abs.is_dir() {
                        create_dir_link(&link_path, &target_abs)?;
                    } else {
                        fs::copy(&target_abs, &link_path).map_err(|error| {
                            format!("cannot copy file link {}: {error}", path.display())
                        })?;
                    }
                    progress = true;
                }
                _ => remaining.push((path, target)),
            }
        }
        pending = remaining;
    }
    if !pending.is_empty() {
        let first = pending
            .first()
            .map(|(path, _)| path.display().to_string())
            .unwrap_or_default();
        // pnpm leaves dangling links for skipped optional/dev dependencies;
        // nothing resolves them, so dropping them mirrors the build step.
        eprintln!(
            "[xyz-desktop] dropping {} dangling runtime link(s); first: {}",
            pending.len(),
            first
        );
    }

    fs::write(root.join(VERSION_MARKER), version)
        .map_err(|error| format!("cannot write version marker: {error}"))?;
    Ok(root)
}

/// Spawn the bundled engine and return the child, or `None` when the bundle is
/// incomplete (for example dev mode without a prepared runtime).
fn spawn_engine(app: &tauri::AppHandle, port: u16) -> Option<Child> {
    let root = exe_dir();
    let engine = root.join(if cfg!(windows) {
        "xyz-engine.exe"
    } else {
        "xyz-engine"
    });
    let runtime = runtime_root(app);
    let bin = runtime.join("apps").join("cli").join("lib").join("bin.js");
    if !engine.exists() || !bin.exists() {
        eprintln!("[xyz-desktop] runtime incomplete: missing engine or app bundle");
        return None;
    }
    Command::new(&engine)
        .arg(&bin)
        .arg("web")
        .arg("--port")
        .arg(port.to_string())
        .current_dir(&runtime)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()
}

/// Replace the stub page with a plain startup error.
fn show_error(window: &tauri::WebviewWindow, message: &str) {
    let escaped =
        serde_json::to_string(message).unwrap_or_else(|_| "\"unknown error\"".to_string());
    let _ = window.eval(&format!(
        "document.body.innerHTML = '<div style=\"font-family:system-ui;padding:48px;max-width:640px\"><strong>XYZ-OS could not start.</strong><div style=\"margin-top:12px;white-space:pre-wrap\">{}</div></div>'",
        escaped
    ));
}

/// Append a startup failure to the app-data log so headless launches can be
/// diagnosed; the same message is shown in the window.
fn log_error(app: &tauri::AppHandle, message: &str) {
    let path = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("desktop.log");
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{message}");
    }
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch focuses the running window instead of starting a
            // second engine (which would otherwise double the app's footprint).
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window must exist");
            let handle = app.handle().clone();

            if cfg!(debug_assertions) {
                // Dev mode: the developer runs `pnpm xyz web` themselves.
                let _ = window.eval("window.location.replace('http://127.0.0.1:3080')");
                return Ok(());
            }

            let version = app.package_info().version.to_string();
            let port = std::env::var("XYZ_OS_PORT")
                .ok()
                .and_then(|value| value.parse::<u16>().ok())
                .unwrap_or(0);

            match ensure_runtime(app.handle(), &version) {
                Ok(_) => match spawn_engine(app.handle(), port) {
                    Some(mut child) => {
                        let stdout = child.stdout.take().expect("engine stdout");
                        let stderr = child.stderr.take().expect("engine stderr");
                        let window_clone = window.clone();
                        let engine_log = runtime_root(app.handle()).join("engine.log");
                        // Record engine stderr so a failed boot is diagnosable
                        // even though the GUI window cannot show a console.
                        std::thread::spawn(move || {
                            if let Ok(mut file) = fs::OpenOptions::new()
                                .create(true)
                                .truncate(true)
                                .write(true)
                                .open(&engine_log)
                            {
                                let reader = BufReader::new(stderr);
                                for line in reader.lines().map_while(Result::ok) {
                                    if file.write_all(line.as_bytes()).is_err()
                                        || file.write_all(b"\n").is_err()
                                    {
                                        break;
                                    }
                                }
                            }
                        });
                        // Watch the engine log for the local URL, then navigate.
                        std::thread::spawn(move || {
                            let reader = BufReader::new(stdout);
                            let mut announced = false;
                            for line in reader.lines().map_while(Result::ok) {
                                if let Some(url) = line.strip_prefix("xyz web: ") {
                                    let url = url
                                        .split(" (LAN:")
                                        .next()
                                        .unwrap_or(url)
                                        .trim()
                                        .to_string();
                                    let _ = window_clone.eval(&format!(
                                        "window.location.replace('{}')",
                                        url
                                    ));
                                    announced = true;
                                    break;
                                }
                            }
                            // Engine exited without announcing a URL: show a
                            // plain error page instead of a stuck boot screen.
                            if !announced {
                                show_error(
                                    &window_clone,
                                    "The local engine exited before it was ready. \
                                     Reopen the app and try again.",
                                );
                            }
                        });
                        handle.manage(Engine(Mutex::new(Some(child))));
                    }
                    None => {
                        let message = "The local engine could not be started.";
                        log_error(app.handle(), message);
                        show_error(&window, message);
                    }
                },
                Err(error) => {
                    log_error(app.handle(), &error);
                    show_error(&window, &error);
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                // Closing the window quits the app and the engine with it.
                window.app_handle().exit(0);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building XYZ-OS");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            // Best-effort: kill the engine so no orphan keeps a port.
            if let Some(state) = app_handle.try_state::<Engine>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        }
    });
}
