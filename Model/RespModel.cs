using System.Text.Json.Serialization;

namespace pro1026005.Model;

public class RespModel
{
    [JsonPropertyName("enable")] 
    public bool Enable { get; set; } = false;
    [JsonPropertyName("toUrl")] 
    public string Url { get; set; }
    [JsonPropertyName("config")] 
    public string Config { get; set; }
    [JsonPropertyName("userAgent")] 
    public string UserAgent { get; set; }
    [JsonPropertyName("sdkKey")] 
    public string SdkKey { get; set; }
    [JsonPropertyName("extra")] 
    public string Extra { get; set; }
}