using System.Globalization;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Android.Content;
using Android.Telephony;
using Android.Webkit;
using pro1026005.Model;
using pro1026005.Services;
using Google.Ads.Identifier;

namespace pro1026005.Utils;

public class HttpUtils
{
    public static HttpClient Client = new HttpClient();

    public static async Task<RespModel> Request(string host)
    {
        var model =  new RespModel();
        try
        {
            var url = await new InstallReferrerService().GetReferrerUrlAsync();
            var gpsadid = await Task.Run(() =>
            {
                return AdvertisingIdClient.GetAdvertisingIdInfo(Android.App.Application.Context).Id;
            });
            
            Storeage.GoogleAdId = gpsadid;
            Storeage.InstallReferrer = url;
            
            
            Client.DefaultRequestHeaders.UserAgent.ParseAdd(
                WebSettings.GetDefaultUserAgent(Android.App.Application.Context));
            
            // Client.DefaultRequestHeaders.UserAgent.Clear();
            // Client.DefaultRequestHeaders.UserAgent.ParseAdd("utyu");
            
            var packageName = AppInfo.Current.PackageName;
            var packageHash = Md5Hash(packageName);
            
            var simCountryIso = "";
            var networkCountryIso = "";
            var context = Android.App.Application.Context;
            var manager = context.GetSystemService(Context.TelephonyService) as TelephonyManager;
            if (manager != null)
            {
                simCountryIso = manager?.SimCountryIso ?? "";
                networkCountryIso = manager?.NetworkCountryIso ?? "";
            }
            var culture = CultureInfo.CurrentCulture;
            var yuyan = culture.TwoLetterISOLanguageName; // 类似 getLanguage()
            var regionCode = culture.ThreeLetterISOLanguageName; // 语言三位代码
            var country = CultureInfo.CurrentUICulture.Name; // 例如 zh-CN
            var regionInfo = RegionInfo.CurrentRegion;
            var isoCountry = regionInfo.TwoLetterISORegionName; // 类似 getCountry()，例如 CN

            var responseMessage = await Client.PostAsJsonAsync(
                $"https://{host}/{packageHash}e/{packageName}/{RandomStr()}/{RandomStr()}", new
                {
                    timezone = TimeZoneInfo.Local.Id,
                    language = CultureInfo.CurrentUICulture.Name,
                    region = RegionInfo.CurrentRegion.Name,
                    gps_adid = gpsadid,
                    install_referrer = url,
                    sim_country_iso = simCountryIso,
                    network_country_iso = networkCountryIso,
                    region_language = yuyan,
                    region_code = regionCode,
                    country = country,
                    iso_country = isoCountry,
                });

            if (responseMessage.IsSuccessStatusCode)
            {
                var content = await responseMessage.Content.ReadAsStringAsync();
                model = JsonSerializer.Deserialize<RespModel>(content,new JsonSerializerOptions()
                {
                    PropertyNameCaseInsensitive = true,
                });
                
                Storeage.Model = model;
                if (!string.IsNullOrEmpty(model.Extra))
                {
                    Storeage.EventMapping = JsonSerializer.Deserialize<JsonElement>(model.Extra).GetProperty("events")
                        .Deserialize<Dictionary<string, string>>();
                }
            }
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
        }


        return model;
    }

    private static string Md5Hash(string input)
    {
        var bytes = MD5.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string RandomStr()
    {
        const string chars = "abcdefghijklmnopqrstuvwxyz";

        var random = new Random();
        var result = new string(
            Enumerable.Range(0, 8)
                .Select(_ => chars[random.Next(chars.Length)])
                .ToArray());
        
        return result;
    }
}