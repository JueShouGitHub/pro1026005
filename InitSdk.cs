using AdjustSdk;

namespace pro1026005;

// All the code in this file is included in all platforms.
public class InitSdk
{
    public static void InitAd(string sdkKey,AdjustEnvironment  environment =  AdjustEnvironment.Production)
    {
        var adjustConfig = new AdjustConfig(sdkKey, environment);
        adjustConfig.LogLevel = AdjustLogLevel.VERBOSE;
        Adjust.InitSdk(adjustConfig);
    }
}