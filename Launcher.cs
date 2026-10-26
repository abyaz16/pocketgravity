using System;
using System.Diagnostics;
using System.IO;

namespace PocketGravity {
    static class Program {
        [STAThread]
        static void Main() {
            try {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string vbsScript = Path.Combine(baseDir, "PocketGravity-Desktop.vbs");

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = @"C:\Windows\System32\wscript.exe";
                psi.Arguments = "\"" + vbsScript + "\"";
                psi.WorkingDirectory = baseDir;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;

                Process.Start(psi);
            } catch (Exception) {
            }
        }
    }
}
