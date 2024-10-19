namespace Unity.License.Patcher;

internal class PatcherLogger : IPatcherLogger
{
    public void Info(string message)
    {
        Console.WriteLine($"[Info] {message}");
    }

    public void Error(string message)
    {
        Console.WriteLine($"[Error] {message}");
    }

    public void Error(Exception e)
    {
        Console.WriteLine($"[Error] {e.Message}");
        Console.WriteLine(e.StackTrace);
    }

    public void Warn(string message)
    {
        Console.WriteLine($"[Warn] {message}");
    }
}