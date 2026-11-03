using Android.Webkit;
using Java.Interop;
using Microsoft.Maui.Handlers;
using Microsoft.Maui.Controls;

namespace pro1026005.Platforms.Android;

public class CustomWebViewHandler : WebViewHandler
{
    protected override void ConnectHandler(global::Android.Webkit.WebView platformView)
    {
        base.ConnectHandler(platformView);

        platformView.Settings.JavaScriptEnabled = true;
        platformView.AddJavascriptInterface(new JsBridge(), "bridge");
    }
}

/// <summary>
/// 注入到 JS 上下文的桥对象。JS 调用：window.bridge.notify(tag, data)。
/// </summary>
public class JsBridge : Java.Lang.Object
{
    [Export("notify")]
    [JavascriptInterface]
    public void Notify(string tag, string data)
        => JsBridgeHub.Raise(tag, data);
}

public static class JsBridgeHub
{
    public static event Action<string, string>? Received;

    internal static void Raise(string tag, string data)
        => Received?.Invoke(tag, data);
}
