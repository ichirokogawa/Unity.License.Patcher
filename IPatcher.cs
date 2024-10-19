namespace Unity.License.Patcher;

internal interface IPatcher
{
    void Patch();

    void Restore();

    void Backup();

    bool GetIsPatched();
}