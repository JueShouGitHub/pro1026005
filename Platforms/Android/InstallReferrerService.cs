using Xamarin.Android.InstallReferrer.Api;

namespace pro1026005.Services;

public partial class InstallReferrerService
{
    private readonly TaskCompletionSource<string?> _tcs = new TaskCompletionSource<string?>();

    public partial Task<string?> GetReferrerUrlAsync()
    {
        var build = InstallReferrerClient.NewBuilder(Android.App.Application.Context).Build();
        build.StartConnection(new MyInstallReferrerStateListener(build, _tcs));
        return _tcs.Task;
    }
}

class MyInstallReferrerStateListener : Java.Lang.Object, IInstallReferrerStateListener
{
    private readonly TaskCompletionSource<string?> _tcs;
    private readonly InstallReferrerClient _client;

    public MyInstallReferrerStateListener(InstallReferrerClient client, TaskCompletionSource<string?> tcs)
    {
        _client = client;
        _tcs = tcs;
    }

    public void OnInstallReferrerServiceDisconnected()
    {
        _tcs.TrySetResult(null);
    }

    public void OnInstallReferrerSetupFinished(int responseCode)
    {
        try
        {
            if (responseCode == InstallReferrerClient.InstallReferrerResponse.Ok)
            {
                _tcs.TrySetResult(_client.InstallReferrer.InstallReferrer);
            }
            else
            {
                _tcs.TrySetResult(null);
            }
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            _tcs.TrySetResult(null);
        }
        finally
        {
            _client.EndConnection();
        }
    }
}