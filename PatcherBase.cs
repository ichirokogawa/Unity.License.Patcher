namespace Unity.License.Patcher;

internal abstract class PatcherBase : IPatcher
{
    protected PatcherBase(IPatcherLogger logger)
    {
        Logger = logger;
    }

    protected IPatcherLogger Logger { get; }

    public void Restore()
    {
        try
        {
            Logger.Info($"{GetClassName()} Restore start");
            InternalRestore();
            Logger.Info($"{GetClassName()} Restore finish");
        }
        catch (Exception e)
        {
            Logger.Error(e);
        }
    }

    public void Patch()
    {
        try
        {
            Logger.Info($"{GetClassName()} Patch start");
            InternalPatch();
            Logger.Info($"{GetClassName()} Patch finish");
        }
        catch (Exception e)
        {
            Logger.Error(e);
        }
    }

    public void Backup()
    {
        try
        {
            Logger.Info($"{GetClassName()} Backup start");
            InternalBackup();
            Logger.Info($"{GetClassName()} Backup finish");
        }
        catch (Exception e)
        {
            Logger.Error(e);
        }
    }

    public abstract bool GetIsPatched();

    private string GetClassName()
    {
        return $"<{GetType().Name}>";
    }

    protected abstract void InternalRestore();

    protected abstract void InternalPatch();

    protected abstract void InternalBackup();
}