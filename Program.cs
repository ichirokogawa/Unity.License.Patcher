using System.CommandLine;
using System.Runtime.CompilerServices;
using Autofac;

namespace Unity.License.Patcher;

internal class Program
{
    private static void SetExecPath([CallerFilePath] string callerFilePath = "")
    {
        var directoryName = Path.GetDirectoryName(callerFilePath);
        if (string.IsNullOrEmpty(directoryName))
        {
            throw new InvalidOperationException("");
        }

        Directory.SetCurrentDirectory(directoryName);
    }

    private static Command CreatePatchCommand(IContainer container)
    {
        var unityFolderOption = CreateUnityFolderOption();
        var unityHubFolderOption = CreateUnityHubFolderOption();
        var unityHubVersionOption = CreateUnityHubVersionOption();

        var command = new Command("patch", "install unity patch")
        {
            unityFolderOption,
            unityHubFolderOption,
            unityHubVersionOption
        };

        command.SetHandler((unityFolder, unityHubFolder, unityHubVersion) =>
        {
            var unityPatcher = container.Resolve<UnityPatcher>(
                new TypedParameter(typeof(string), unityFolder));
            unityPatcher.Patch();

            var unityHubPatcher = ResolveUnityHubPatcher(
                container,
                unityHubFolder,
                unityHubVersion);
            unityHubPatcher.Patch();
        }, unityFolderOption, unityHubFolderOption, unityHubVersionOption);
        return command;
    }


    private static Command CreateRestoreCommand(IContainer container)
    {
        var unityFolderOption = CreateUnityFolderOption();
        var unityHubFolderOption = CreateUnityHubFolderOption();
        var unityHubVersionOption = CreateUnityHubVersionOption();

        var command = new Command("restore", "uninstall unity patch")
        {
            unityFolderOption,
            unityHubFolderOption,
            unityHubVersionOption
        };

        command.SetHandler((unityFolder, unityHubFolder, unityHubVersion) =>
        {
            var unityPatcher = container.Resolve<UnityPatcher>(
                new TypedParameter(typeof(string), unityFolder));
            unityPatcher.Restore();

            var unityHubPatcher = ResolveUnityHubPatcher(
                container,
                unityHubFolder,
                unityHubVersion);
            unityHubPatcher.Restore();
        }, unityFolderOption, unityHubFolderOption, unityHubVersionOption);
        return command;
    }

    private static PatcherBase ResolveUnityHubPatcher(IContainer container, string unityHubFolder,
        UnityHubVersion version)
    {
        Type t;

        switch (version)
        {
            case UnityHubVersion.V2:
                t = typeof(UnityHubV2Patcher);
                break;
            case UnityHubVersion.V3_8:
                t = typeof(UnityHubV3_8Patcher);
                break;
            case UnityHubVersion.V3_9:
                t = typeof(UnityHubV3_8Patcher);
                break;
            default:
                throw new NotSupportedException();
        }

        return (PatcherBase)container.Resolve(t, new TypedParameter(typeof(string), unityHubFolder));
    }

    private static Option<string> CreateUnityFolderOption()
    {
        return new Option<string>(
            "--UnityFolder",
            "unity folder");
    }


    private static Option<string> CreateUnityHubFolderOption()
    {
        return new Option<string>(
            "--UnityHubFolder",
            () => "C:\\Program Files\\Unity Hub",
            "unity hub folder");
    }

    private static Option<UnityHubVersion> CreateUnityHubVersionOption()
    {
        return new Option<UnityHubVersion>(
            "--UnityHubVersion",
            () => UnityHubVersion.V3_8,
            "unity hub version");
    }


    private static async Task Main(string[] args)
    {
        SetExecPath();

        var builder = new ContainerBuilder();

        builder.RegisterType<PatcherLogger>()
            .As<IPatcherLogger>()
            .SingleInstance();

        builder.RegisterType<CerPatcher>();

        builder.RegisterType<UnityPatcher>();
        builder.RegisterType<UnityHubV2Patcher>();
        builder.RegisterType<UnityHubV3_8Patcher>();

        var container = builder.Build();


        var rootCommand = new RootCommand
        {
            CreatePatchCommand(container),
            CreateRestoreCommand(container)
        };


        await rootCommand.InvokeAsync(args);
    }
}