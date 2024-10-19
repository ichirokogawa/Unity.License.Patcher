namespace Unity.License.Patcher;

internal interface IPatcherLogger
{
    void Info(string message);

    void Error(string message);

    void Error(Exception e);

    void Warn(string message);
}