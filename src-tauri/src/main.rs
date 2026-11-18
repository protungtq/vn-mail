// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `vnmail --version` answers without opening a window, so a package can be checked on a server.
    if std::env::args().any(|arg| arg == "--version" || arg == "-V") {
        println!("vnmail {}", env!("CARGO_PKG_VERSION"));
        return;
    }
    // On Wayland, WebKitGTK's accelerated drawing path keeps the wrong scale when screens
    // differ (a 200% laptop screen beside 100% monitors): the whole window is drawn
    // blurred. The other path draws sharp. Set the variable yourself to choose.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WAYLAND_DISPLAY").is_some() && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        // Nothing else is running yet, so changing the environment is safe.
        unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
    }
    vnmail_lib::mark_start();
    vnmail_lib::run()
}
