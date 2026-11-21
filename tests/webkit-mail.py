"""Run the mail reader fixture in a real WebKitGTK web view."""

import sys

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import GLib, Gtk, WebKit2

PROBE = "https://127.0.0.1:1420/webkit-mail-probe.png"
view = WebKit2.WebView()
window = Gtk.Window()
window.add(view)
result = 1


def fail(message):
    print(message, file=sys.stderr)
    Gtk.main_quit()
    return GLib.SOURCE_REMOVE


def resource_started(web_view, resource, request):
    if request.get_uri() != PROBE:
        return
    if web_view.get_title() != "Show images clicked":
        fail("WebKit attempted to load the remote image before opt-in")
        return
    global result
    result = 0
    print("WebKit blocked the image by default and attempted it after opt-in.")
    Gtk.main_quit()


view.connect("resource-load-started", resource_started)
window.show_all()
GLib.timeout_add_seconds(25, fail, "Timed out waiting for the opted-in image request")
view.load_uri("http://127.0.0.1:1420/tests/webkit-mail.html")
Gtk.main()
sys.exit(result)
