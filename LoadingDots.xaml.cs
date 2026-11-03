using Microsoft.Maui.Controls.Shapes;

namespace pro1026005;

public partial class LoadingDots : ContentView
{
    public static readonly BindableProperty DotColorProperty =
        BindableProperty.Create(nameof(DotColor), typeof(Color), typeof(LoadingDots), Colors.White);

    public Color DotColor
    {
        get => (Color)GetValue(DotColorProperty);
        set => SetValue(DotColorProperty, value);
    }

    public static readonly BindableProperty IsRunningProperty =
        BindableProperty.Create(nameof(IsRunning), typeof(bool), typeof(LoadingDots), false,
            propertyChanged: OnIsRunningChanged);

    public bool IsRunning
    {
        get => (bool)GetValue(IsRunningProperty);
        set => SetValue(IsRunningProperty, value);
    }

    private static void OnIsRunningChanged(BindableObject bindable, object oldValue, object newValue)
    {
        if (bindable is LoadingDots dots)
        {
            if ((bool)newValue)
                dots.StartAnimation();
            else
                dots.StopAnimation();
        }
    }

    private CancellationTokenSource? _cts;

    public LoadingDots()
    {
        InitializeComponent();
    }

    protected override void OnParentSet()
    {
        base.OnParentSet();
        if (IsRunning)
            StartAnimation();
    }

    private void StartAnimation()
    {
        _cts?.Cancel();
        _cts = new CancellationTokenSource();
        _ = RunAnimationAsync(_cts.Token);
    }

    private void StopAnimation()
    {
        _cts?.Cancel();
        this.AbortAnimation("dot1");
        this.AbortAnimation("dot2");
        this.AbortAnimation("dot3");
        Dot1.Scale = 0.5;
        Dot2.Scale = 0.5;
        Dot3.Scale = 0.5;
    }

    private async Task RunAnimationAsync(CancellationToken ct)
    {
        try
        {
            await Task.WhenAll(
                AnimateDotAsync("dot1", Dot1, 0, ct),
                AnimateDotAsync("dot2", Dot2, 160, ct),
                AnimateDotAsync("dot3", Dot3, 320, ct)
            );
        }
        catch (TaskCanceledException)
        {
            // 正常取消
        }
    }

    private async Task AnimateDotAsync(string name, Ellipse dot, int delayMs, CancellationToken ct)
    {
        dot.Scale = 0.5;
        dot.Opacity = 0.5;

        await Task.Delay(delayMs, ct);

        while (!ct.IsCancellationRequested)
        {
            await Task.WhenAll(
                dot.ScaleTo(1.2, 400, Easing.SinInOut),
                dot.FadeTo(1.0, 200, Easing.SinInOut)
            );

            await Task.Delay(100, ct);

            await Task.WhenAll(
                dot.ScaleTo(0.5, 400, Easing.SinInOut),
                dot.FadeTo(0.5, 200, Easing.SinInOut)
            );

            await Task.Delay(100, ct);
        }
    }
}
