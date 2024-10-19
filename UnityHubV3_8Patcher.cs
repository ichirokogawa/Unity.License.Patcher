using Autofac;

namespace Unity.License.Patcher;

// ReSharper disable InconsistentNaming
internal class UnityHubV3_8Patcher : PatcherBase
{
    public UnityHubV3_8Patcher(
        IPatcherLogger logger,
        ILifetimeScope lifetimeScope,
        string unityHubFolder) : base(logger)
    {
        UnityHubFolder = unityHubFolder;

        CerPatcher = lifetimeScope.Resolve<CerPatcher>(
            new TypedParameter(typeof(string), LicenseResolver));
    }


    private string UnityHubFolder { get; }

    private CerPatcher CerPatcher { get; }

    private string UnityLicensingClient_V1 => $"{UnityHubFolder}\\{nameof(UnityLicensingClient_V1)}";

    private string LicenseResolver => $"{UnityLicensingClient_V1}\\Unity.Licensing.EntitlementResolver.dll";

    private string LicenseResolverBak => $"{LicenseResolver}.bak";


    public override bool GetIsPatched()
    {
        return File.Exists(LicenseResolverBak);
    }

    protected override void InternalRestore()
    {
        if (!File.Exists(LicenseResolverBak))
        {
            throw new InvalidOperationException("Lost bak !!");
        }

        File.Copy(LicenseResolverBak, LicenseResolver, true);
        File.Delete(LicenseResolverBak);
    }

    protected override void InternalPatch()
    {
        if (GetIsPatched())
        {
            Logger.Warn("Already patched !!");
        }

        Backup();
        CerPatcher.Patch();
        LicenseTools.Sign();
    }

    protected override void InternalBackup()
    {
        if (File.Exists(LicenseResolverBak))
        {
            return;
        }

        if (GetIsPatched())
        {
            throw new InvalidOperationException("Cant backup patched file !!");
        }

        File.WriteAllBytes(LicenseResolverBak, File.ReadAllBytes(LicenseResolver));
    }
}