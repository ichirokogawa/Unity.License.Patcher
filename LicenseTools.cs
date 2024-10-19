using System.Security.Cryptography;
using System.Security.Cryptography.Xml;
using System.Xml;

namespace Unity.License.Patcher;

internal static class LicenseTools
{
    static LicenseTools()
    {
        XmlLicense = new XmlDocument
        {
            PreserveWhitespace = true
        };
        XmlLicense.Load("patch\\util\\license.xml");
        RsaKey = LoadPrivateKey("patch\\util\\private.key");
    }

    private static RSA RsaKey { get; }

    private static XmlDocument XmlLicense { get; }

    private static string UnityLic => "C:\\ProgramData\\Unity\\Unity_lic.ulf";

    private static RSA LoadPrivateKey(string privateKeyPath)
    {
        var privateKeyText = File.ReadAllText(privateKeyPath);
        var privateKeyBytes = Convert.FromBase64String(privateKeyText);
        var rsa = RSA.Create();
        rsa.ImportRSAPrivateKey(privateKeyBytes, out _);
        return rsa;
    }

    public static void Sign()
    {
        var signedXml = new SignedXml(XmlLicense)
        {
            SigningKey = RsaKey
        };

        var reference = new Reference
        {
            Uri = "#Terms"
        };
        var env = new XmlDsigEnvelopedSignatureTransform();
        reference.AddTransform(env);
        signedXml.AddReference(reference);

        signedXml.ComputeSignature();

        var xmlDigitalSignature = signedXml.GetXml();
        XmlLicense.DocumentElement!.AppendChild(XmlLicense.ImportNode(xmlDigitalSignature, true));
        XmlLicense.Save(UnityLic);
    }
}