// Brasa no PC: a mascote do Game Life sentada logo acima da barra de tarefas do Windows.
// Programa próprio, sem navegador. Compilado pelo instalar.ps1 com o csc que já vem no Windows
// (.NET Framework 4), por isso o código usa só C# 5.
//
// - Fica sempre por cima, sem borda, com transparência de verdade (bordas suaves).
// - Respira devagar e troca de pose de tempos em tempos.
// - Dorme das 23h às 5h. Nas janelas de refeição (5-11h, 11-15h, 17-22h) pede comida até você clicar nela.
// - Clique: carinho (ou, com fome, abre o Game Life). Clique duplo: abre o Game Life.
// - Arrastar: muda de lugar. Botão direito (ou ícone perto do relógio): menu.
// Não usa internet: só abre o endereço do Game Life no navegador quando você pede.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

static class Programa
{
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    [STAThread]
    static void Main()
    {
        bool sozinho;
        using (var m = new Mutex(true, "BrasaPC-unica", out sozinho))
        {
            if (!sozinho) return; // já está rodando
            try { SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            Application.Run(new BrasaJanela());
        }
    }
}

/// <summary>Regras de horário, iguais às do Game Life.</summary>
static class Regras
{
    /// <summary>Dia do jogo: vira às 3h.</summary>
    public static string DiaDoJogo(DateTime t) { return t.AddHours(-3).ToString("yyyy-MM-dd"); }

    public static string Janela(int h)
    {
        if (h >= 5 && h < 11) return "manha";
        if (h >= 11 && h < 15) return "almoco";
        if (h >= 17 && h < 22) return "noite";
        return null;
    }

    public static bool Madrugada(int h) { return h >= 23 || h < 5; }
}

/// <summary>Configurações guardadas em %LOCALAPPDATA%\BrasaPC\config.txt (chave=valor).</summary>
class Config
{
    readonly string arquivo;
    readonly Dictionary<string, string> v = new Dictionary<string, string>();

    public Config(string pasta)
    {
        arquivo = Path.Combine(pasta, "config.txt");
        try
        {
            foreach (var linha in File.ReadAllLines(arquivo))
            {
                int i = linha.IndexOf('=');
                if (i > 0) v[linha.Substring(0, i)] = linha.Substring(i + 1);
            }
        }
        catch { }
    }

    public string Texto(string k, string padrao) { string s; return v.TryGetValue(k, out s) ? s : padrao; }
    public int Numero(string k, int padrao) { int n; return int.TryParse(Texto(k, ""), out n) ? n : padrao; }
    public void Por(string k, object valor) { v[k] = Convert.ToString(valor); Salvar(); }

    void Salvar()
    {
        try
        {
            var linhas = new List<string>();
            foreach (var p in v) linhas.Add(p.Key + "=" + p.Value);
            File.WriteAllLines(arquivo, linhas.ToArray());
        }
        catch { }
    }
}

class Poses
{
    public string Sono, Fome, Carinho;
    public string[] Repouso;
    /// <summary>Estágios 2 e 3 não têm desenho de fome: mostra um balãozinho.</summary>
    public bool BalaoFome;

    public static Poses DoEstagio(int e)
    {
        if (e == 3) return new Poses { Sono = "e3-dormindo", Fome = "e3-base", Carinho = "e3-carinhosa", BalaoFome = true,
            Repouso = new[] { "e3-feliz", "e3-pronta", "e3-base", "e3-feliz" } };
        if (e == 2) return new Poses { Sono = "e2-cansada", Fome = "e2-curiosa", Carinho = "e2-feliz", BalaoFome = true,
            Repouso = new[] { "e2-feliz", "e2-curiosa", "e2-brincando", "e2-base", "e2-animada" } };
        return new Poses { Sono = "e1-dormindo", Fome = "e1-com-fome", Carinho = "e1-carinhosa", BalaoFome = false,
            Repouso = new[] { "e1-feliz", "e1-curiosa", "e1-relaxada", "e1-base", "e1-animada", "e1-feliz" } };
    }
}

class BrasaJanela : Form
{
    const string GAME_LIFE = "https://gabrielpleite.github.io/game-life/";
    static readonly string[] NOMES_ESTAGIO = { "", "Pequena Brasa", "Chama Crescente", "Salamandra Ardente" };
    static readonly int[] TAMANHOS = { 96, 128, 170 };

    readonly string pasta;
    readonly Config cfg;
    readonly Dictionary<string, Bitmap> imagens = new Dictionary<string, Bitmap>();
    readonly Random sorte = new Random();
    readonly System.Windows.Forms.Timer quadro = new System.Windows.Forms.Timer();
    readonly System.Windows.Forms.Timer minuto = new System.Windows.Forms.Timer();
    readonly NotifyIcon bandeja = new NotifyIcon();
    readonly ToolTip dica = new ToolTip();
    readonly float escala;

    int lado;                 // tamanho da Brasa em pixels de tela
    string poseRepouso;       // pose sorteada para os momentos tranquilos
    DateTime trocarRepousoEm = DateTime.MinValue;
    string reacao;            // pose de reação (carinho) por alguns segundos
    DateTime reacaoAte = DateTime.MinValue;
    DateTime escondidaAte = DateTime.MinValue;
    bool comFome;
    string poseAtual;
    DateTime inicio = DateTime.Now;
    bool pronta;              // já apareceu na tela (antes disso, quem mostra é o Application.Run)

    // Arrastar
    bool apertado, arrastando;
    Point apertouEm, janelaEm;

    public BrasaJanela()
    {
        pasta = Path.GetDirectoryName(Application.ExecutablePath);
        var dados = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BrasaPC");
        Directory.CreateDirectory(dados);
        cfg = new Config(dados);

        using (var g = CreateGraphics()) escala = g.DpiX / 96f;

        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        Text = "Brasa";
        AplicarTamanho();

        var menu = MontarMenu();
        ContextMenuStrip = menu;
        try { bandeja.Icon = new Icon(Path.Combine(pasta, "brasa.ico")); } catch { bandeja.Icon = SystemIcons.Application; }
        bandeja.Text = "Brasa";
        bandeja.ContextMenuStrip = menu;
        bandeja.Visible = true;
        bandeja.MouseClick += (s, e) => { if (e.Button == MouseButtons.Left) Reaparecer(); };

        MouseDown += AoApertar;
        MouseMove += AoMover;
        MouseUp += AoSoltar;
        MouseDoubleClick += (s, e) => { if (e.Button == MouseButtons.Left) AbrirGameLife(); };

        quadro.Interval = 50; // 20 quadros por segundo: só a respiração
        quadro.Tick += (s, e) => Desenhar();
        minuto.Interval = 20000;
        minuto.Tick += (s, e) => { TopMost = false; TopMost = true; AtualizarEstado(); };

        AtualizarEstado();
        quadro.Start();
        minuto.Start();
    }

    // ---------- Janela transparente de verdade (por pixel) ----------

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ExStyle |= 0x00080000; // WS_EX_LAYERED
            cp.ExStyle |= 0x00000080; // WS_EX_TOOLWINDOW: fora do Alt+Tab
            cp.ExStyle |= 0x00000008; // WS_EX_TOPMOST
            return cp;
        }
    }

    [StructLayout(LayoutKind.Sequential)] struct PONTO { public int x, y; public PONTO(int x, int y) { this.x = x; this.y = y; } }
    [StructLayout(LayoutKind.Sequential)] struct TAMANHO { public int cx, cy; public TAMANHO(int x, int y) { cx = x; cy = y; } }
    [StructLayout(LayoutKind.Sequential, Pack = 1)] struct MISTURA { public byte op, flags, alpha, formato; }

    [DllImport("user32.dll")] static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref PONTO pptDst, ref TAMANHO psize, IntPtr hdcSrc, ref PONTO pptSrc, int crKey, ref MISTURA pblend, int dwFlags);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hWnd);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr hDC);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr hdc);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr hDC, IntPtr hObject);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr hObject);

    void Mostrar(Bitmap bmp)
    {
        IntPtr tela = GetDC(IntPtr.Zero), mem = CreateCompatibleDC(tela), hbmp = IntPtr.Zero, antigo = IntPtr.Zero;
        try
        {
            hbmp = bmp.GetHbitmap(Color.FromArgb(0));
            antigo = SelectObject(mem, hbmp);
            var tam = new TAMANHO(bmp.Width, bmp.Height);
            var origem = new PONTO(0, 0);
            var destino = new PONTO(Left, Top);
            var mistura = new MISTURA { op = 0, flags = 0, alpha = 255, formato = 1 }; // AC_SRC_OVER, AC_SRC_ALPHA
            UpdateLayeredWindow(Handle, tela, ref destino, ref tam, mem, ref origem, 0, ref mistura, 2); // ULW_ALPHA
        }
        finally
        {
            ReleaseDC(IntPtr.Zero, tela);
            if (hbmp != IntPtr.Zero) { SelectObject(mem, antigo); DeleteObject(hbmp); }
            DeleteDC(mem);
        }
    }

    // ---------- Estado ----------

    int Estagio { get { return Math.Max(1, Math.Min(3, cfg.Numero("estagio", 1))); } }

    void AtualizarEstado()
    {
        var agora = DateTime.Now;
        if (pronta)
        {
            if (escondidaAte > agora) { if (Visible) Hide(); return; }
            if (!Visible) Show();
        }

        var p = Poses.DoEstagio(Estagio);
        string janela = Regras.Janela(agora.Hour);
        string visita = Regras.DiaDoJogo(agora) + ":" + janela;
        comFome = janela != null && cfg.Texto("visita", "") != visita && !Regras.Madrugada(agora.Hour);

        if (poseRepouso == null || agora >= trocarRepousoEm || Array.IndexOf(p.Repouso, poseRepouso) < 0)
        {
            poseRepouso = p.Repouso[sorte.Next(p.Repouso.Length)];
            trocarRepousoEm = agora.AddMinutes(4 + sorte.Next(8));
        }

        string pose;
        if (reacao != null && agora < reacaoAte) pose = reacao;
        else if (Regras.Madrugada(agora.Hour)) pose = p.Sono;
        else if (comFome) pose = p.Fome;
        else pose = poseRepouso;
        poseAtual = pose;

        string humor = Regras.Madrugada(agora.Hour) ? "dormindo" : comFome ? "com fome (clique para abrir o Game Life)" : "por aqui com você";
        string texto = NOMES_ESTAGIO[Estagio] + ": " + humor;
        dica.SetToolTip(this, texto);
        bandeja.Text = texto.Length > 63 ? texto.Substring(0, 63) : texto;
    }

    Bitmap Imagem(string nome)
    {
        Bitmap b;
        if (imagens.TryGetValue(nome, out b)) return b;
        try { b = new Bitmap(Path.Combine(pasta, "brasa", nome + ".png")); }
        catch { b = null; }
        imagens[nome] = b;
        return b;
    }

    // ---------- Desenho ----------

    void Desenhar()
    {
        if (!Visible || poseAtual == null) return;
        if (reacao != null && DateTime.Now >= reacaoAte) { reacao = null; AtualizarEstado(); }
        var img = Imagem(poseAtual);
        if (img == null) return;

        bool dormindo = Regras.Madrugada(DateTime.Now.Hour);
        double t = (DateTime.Now - inicio).TotalSeconds;
        double ciclo = dormindo ? 4.5 : 3.2;
        float respira = (float)Math.Sin(t * 2 * Math.PI / ciclo);
        float sy = 1f + 0.025f * respira, sx = 1f - 0.012f * respira;

        using (var bmp = new Bitmap(lado, lado, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.Transparent);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;

            // Cabe no quadrado, apoiada no chão (base), respirando a partir dos pés.
            float margem = lado * 0.06f;
            float caixa = lado - 2 * margem;
            float k = Math.Min(caixa / img.Width, caixa / img.Height);
            float w = img.Width * k * sx, h = img.Height * k * sy;
            float x = (lado - w) / 2f, y = lado - margem * 0.4f - h;
            g.DrawImage(img, x, y, w, h);

            var p = Poses.DoEstagio(Estagio);
            if (comFome && p.BalaoFome && reacao == null) Balao(g, "\U0001F356");
            if (dormindo) Zzz(g, t);
            bmp.SetResolution(96, 96);
            Mostrar(bmp);
        }
    }

    void Balao(Graphics g, string texto)
    {
        float d = lado * 0.32f;
        var r = new RectangleF(lado - d - lado * 0.02f, lado * 0.02f, d, d);
        using (var fundo = new SolidBrush(Color.FromArgb(240, 255, 250, 240)))
        using (var borda = new Pen(Color.FromArgb(255, 179, 54, 27), Math.Max(1.5f, lado / 60f)))
        using (var fonte = new Font("Segoe UI Emoji", d * 0.42f, GraphicsUnit.Pixel))
        using (var tinta = new SolidBrush(Color.FromArgb(255, 120, 50, 20)))
        using (var centro = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
        {
            g.FillEllipse(fundo, r);
            g.DrawEllipse(borda, r);
            g.DrawString(texto, fonte, tinta, r, centro);
        }
    }

    void Zzz(Graphics g, double t)
    {
        using (var fonte = new Font("Segoe UI", lado * 0.13f, FontStyle.Bold, GraphicsUnit.Pixel))
        {
            for (int i = 0; i < 3; i++)
            {
                double f = (t / 3.0 + i / 3.0) % 1.0; // sobe e some
                int a = (int)(220 * Math.Sin(f * Math.PI));
                using (var tinta = new SolidBrush(Color.FromArgb(Math.Max(0, a), 90, 70, 140)))
                    g.DrawString(i == 2 ? "Z" : "z", fonte, tinta, lado * (0.66f + 0.08f * i), lado * (0.42f - 0.32f * (float)f));
            }
        }
    }

    // ---------- Posição e tamanho ----------

    void AplicarTamanho()
    {
        int t = cfg.Numero("tamanho", 1);
        lado = (int)(TAMANHOS[Math.Max(0, Math.Min(2, t))] * escala);
        Size = new Size(lado, lado);
        int x = cfg.Numero("x", int.MinValue), y = cfg.Numero("y", int.MinValue);
        if (x == int.MinValue || !NaTela(new Point(x, y))) PertoDaBarra();
        else Location = new Point(x, y);
    }

    bool NaTela(Point p)
    {
        foreach (var s in Screen.AllScreens)
            if (s.WorkingArea.IntersectsWith(new Rectangle(p, new Size(lado, lado)))) return true;
        return false;
    }

    /// <summary>Sentada em cima da barra de tarefas, à direita, perto do relógio.</summary>
    void PertoDaBarra()
    {
        var a = Screen.PrimaryScreen.WorkingArea;
        Location = new Point(a.Right - lado - (int)(24 * escala), a.Bottom - lado);
        cfg.Por("x", Left);
        cfg.Por("y", Top);
    }

    // ---------- Mouse ----------

    void AoApertar(object s, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;
        apertado = true; arrastando = false;
        apertouEm = Cursor.Position; janelaEm = Location;
    }

    void AoMover(object s, MouseEventArgs e)
    {
        if (!apertado) return;
        var c = Cursor.Position;
        int dx = c.X - apertouEm.X, dy = c.Y - apertouEm.Y;
        if (!arrastando && Math.Abs(dx) + Math.Abs(dy) > SystemInformation.DragSize.Width) arrastando = true;
        if (arrastando) Location = new Point(janelaEm.X + dx, janelaEm.Y + dy);
    }

    void AoSoltar(object s, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left || !apertado) return;
        apertado = false;
        if (arrastando)
        {
            // Se soltar perto da barra de tarefas, gruda em cima dela.
            var a = Screen.FromPoint(Cursor.Position).WorkingArea;
            if (Math.Abs(Bottom - a.Bottom) < lado / 2) Top = a.Bottom - lado;
            cfg.Por("x", Left);
            cfg.Por("y", Top);
            return;
        }
        if (comFome) { MarcarVisita(); AbrirGameLife(); return; }
        reacao = Poses.DoEstagio(Estagio).Carinho;
        reacaoAte = DateTime.Now.AddSeconds(3);
        AtualizarEstado();
    }

    void MarcarVisita()
    {
        var agora = DateTime.Now;
        string j = Regras.Janela(agora.Hour);
        if (j != null) cfg.Por("visita", Regras.DiaDoJogo(agora) + ":" + j);
        AtualizarEstado();
    }

    void AbrirGameLife()
    {
        try { Process.Start(GAME_LIFE); } catch { }
    }

    void Reaparecer()
    {
        escondidaAte = DateTime.MinValue;
        AtualizarEstado();
        TopMost = false; TopMost = true;
    }

    // ---------- Menu ----------

    ContextMenuStrip MontarMenu()
    {
        var m = new ContextMenuStrip();
        m.Items.Add("Abrir o Game Life", null, (s, e) => AbrirGameLife());
        m.Items.Add("Já dei comida (até a próxima refeição)", null, (s, e) => MarcarVisita());
        m.Items.Add(new ToolStripSeparator());

        var estagio = new ToolStripMenuItem("Tamanho dela no jogo");
        for (int i = 1; i <= 3; i++)
        {
            int n = i;
            var item = new ToolStripMenuItem(NOMES_ESTAGIO[n], null, (s, e) => { cfg.Por("estagio", n); poseRepouso = null; AtualizarEstado(); });
            estagio.DropDownItems.Add(item);
        }
        estagio.DropDownOpening += (s, e) => { for (int i = 0; i < 3; i++) ((ToolStripMenuItem)estagio.DropDownItems[i]).Checked = Estagio == i + 1; };
        m.Items.Add(estagio);

        var tamanho = new ToolStripMenuItem("Tamanho na tela");
        string[] nomes = { "Pequena", "Média", "Grande" };
        for (int i = 0; i < 3; i++)
        {
            int n = i;
            tamanho.DropDownItems.Add(new ToolStripMenuItem(nomes[n], null, (s, e) => { cfg.Por("tamanho", n); AplicarTamanho(); }));
        }
        tamanho.DropDownOpening += (s, e) => { for (int i = 0; i < 3; i++) ((ToolStripMenuItem)tamanho.DropDownItems[i]).Checked = cfg.Numero("tamanho", 1) == i; };
        m.Items.Add(tamanho);

        m.Items.Add("Voltar para cima da barra de tarefas", null, (s, e) => PertoDaBarra());
        m.Items.Add("Esconder por 1 hora", null, (s, e) => { escondidaAte = DateTime.Now.AddHours(1); AtualizarEstado(); });
        m.Items.Add("Mostrar agora", null, (s, e) => Reaparecer());
        m.Items.Add(new ToolStripSeparator());
        m.Items.Add("Fechar a Brasa", null, (s, e) => Close());
        return m;
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        pronta = true;
        Desenhar();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        bandeja.Visible = false;
        bandeja.Dispose();
        base.OnFormClosed(e);
    }
}
