using Autofac;

namespace Unity.License.Patcher;

internal class UnityPatcher : PatcherBase
{
    public UnityPatcher(
        IPatcherLogger logger,
        ILifetimeScope lifetimeScope,
        string unityFolder) : base(logger)
    {
        UnityFolder = unityFolder;

        CerPatcher = lifetimeScope.Resolve<CerPatcher>(
            new TypedParameter(typeof(string),
                LicenseResolver));
    }

    private string UnityFolder { get; }

    private CerPatcher CerPatcher { get; }

    private string LicenseResolverFolder => $"{UnityFolder}\\Editor\\Data\\Resources\\Licensing\\Client";

    private string LicenseResolver => $"{LicenseResolverFolder}\\Unity.Licensing.EntitlementResolver.dll";

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