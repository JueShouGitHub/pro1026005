namespace pro1026005;

public partial class App : Application
{
	public App()
	{
		InitializeComponent();
	}

	protected override Window CreateWindow(IActivationState? activationState)
	{
		var navigationPage = new NavigationPage(new MainPage());
		return new Window(navigationPage) { Title = "pro1026005" };
	}
}
