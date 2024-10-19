using ZYC.AutomationTools;

namespace Unity.License.Patcher;

internal class CerPatcher
{
    public CerPatcher(string licenseResolverPath)
    {
        LicenseResolverPath = licenseResolverPath;
        var cerName = "Unity.Licensing.EntitlementResolver.Unity.cer";

        CerOriBytes = File.ReadAllBytes($"patch\\util\\ori\\{cerName}");
        CerTargetBytes = File.ReadAllBytes($"patch\\util\\target\\{cerName}");

        LicenseResolverBytes = File.ReadAllBytes(licenseResolverPath);
    }

    private string LicenseResolverPath { get; }

    private byte[] LicenseResolverBytes { get; }

    private byte[] CerTargetBytes { get; }

    private byte[] CerOriBytes { get; }

    public void Patch()
    {
        var bytes = ReplaceTools.ReplaceBytes(LicenseResolverBytes, CerOriBytes, CerTargetBytes);
        File.WriteAllBytes(LicenseResolverPath, bytes);
    }
}