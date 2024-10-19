using ZYC.AutomationTools.Asar;

namespace Unity.License.Patcher;

internal class UnityHubV2Patcher : PatcherBase
{
    public UnityHubV2Patcher(
        IPatcherLogger logger,
        string unityHubFolder) : base(logger)
    {
        UnityHubFolder = unityHubFolder;
    }

    private string UnityHubFolder { get; }

    private string AppBackupFile => $"{UnityHubFolder}\\resources\\app.asar.bak";

    private string AppFile => $"{UnityHubFolder}\\resources\\app.asar";

    private string AppExtractFolder => $"{UnityHubFolder}\\resources\\app";


    public override bool GetIsPatched()
    {
        return Directory.Exists(AppExtractFolder);
    }

    protected override void InternalRestore()
    {
        if (!File.Exists(AppBackupFile))
        {
            throw new InvalidOperationException($"Backup file <{AppBackupFile}> not exist !!");
        }

        File.Copy(AppBackupFile, AppFile, true);

        if (!Directory.Exists(AppExtractFolder))
        {
            return;
        }

        Directory.Delete(AppExtractFolder, true);
    }

    protected override void InternalPatch()
    {
        if (GetIsPatched())
        {
            Logger.Warn("Already patched !!");
        }


        Backup();

        var asarExtractor = new AsarExtractor();
        asarExtractor.ExtractAll(new AsarArchive(AppFile),
            AppExtractFolder).Wait();

        File.Copy("patch\\v2\\target\\licenseClient.js",
            $"{AppExtractFolder}\\build\\services\\licenseService\\licenseClient.js",
            true);
        File.Copy("patch\\v2\\target\\auth.js",
            $"{AppExtractFolder}\\build\\services\\localAuth\\auth.js",
            true);

        var subDirectories = Directory.GetDirectories(
            $"{UnityHubFolder}\\resources\\app.asar.unpacked",
            "",
            SearchOption.TopDirectoryOnly);

        foreach (var directory in subDirectories)
        {
            var info = new DirectoryInfo(directory);
            CopyDirectory(directory,
                $"{AppExtractFolder}\\{info.Name}");
        }

        File.Move($"{AppExtractFolder}\\filespackage.json",
            $"{AppExtractFolder}\\package.json", true);
        File.Delete(AppFile);
    }

    protected override void InternalBackup()
    {
        if (File.Exists(AppBackupFile))
        {
            return;
        }

        File.Copy(AppFile, AppBackupFile);
    }

    private static void CopyDirectory(string sourceDir, string destinationDir, bool recursive = true)
    {
        // Get information about the source directory
        var dir = new DirectoryInfo(sourceDir);

        // Check if the source directory exists
        if (!dir.Exists)
        {
            throw new DirectoryNotFoundException($"Source directory not found: {dir.FullName}");
        }

        // Cache directories before we start copying
        var dirs = dir.GetDirectories();

        // Create the destination directory
        Directory.CreateDirectory(destinationDir);

        // Get the files in the source directory and copy to the destination directory
        foreach (var file in dir.GetFiles())
        {
            var targetFilePath = Path.Combine(destinationDir, file.Name);
            file.CopyTo(targetFilePath, true);
        }

        // If recursive and copying subdirectories, recursively call this method
        if (!recursive)
        {
            return;
        }

        foreach (var subDir in dirs)
        {
            var newDestinationDir = Path.Combine(destinationDir, subDir.Name);
            CopyDirectory(subDir.FullName, newDestinationDir);
        }
    }
}