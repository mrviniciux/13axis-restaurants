"""
Gera proposta-comercial.pdf — fpdf2 >= 2.7 com fonte Unicode embutida.
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
import os

# ── Paleta ────────────────────────────────────────────────────────────────────
DARK    = (30,  30,  30)
MUTED   = (110, 110, 110)
GREEN   = (24,  118, 83)
GREEN_L = (234, 245, 238)
RULE_C  = (220, 228, 222)
WHITE   = (255, 255, 255)
THEAD   = (240, 244, 241)
STRIPE  = (248, 251, 248)

def rgb(t):
    return t[0], t[1], t[2]


class PDF(FPDF):
    ML = 18   # left margin
    MR = 18   # right margin
    MT = 20   # top margin

    def __init__(self):
        super().__init__()
        self.set_margins(self.ML, self.MT, self.MR)
        self.set_auto_page_break(auto=True, margin=22)
        self._font_added = False

    def _add_unicode_font(self):
        if self._font_added:
            return
        # fpdf2 ships DejaVu fonts as a package resource
        try:
            self.add_font("DejaVu",       style="",  fname="DejaVuSans.ttf",       uni=True)
            self.add_font("DejaVu",       style="B", fname="DejaVuSans-Bold.ttf",  uni=True)
            self.add_font("DejaVu",       style="I", fname="DejaVuSans-Oblique.ttf", uni=True)
        except Exception:
            pass  # fall back to built-in helvetica (latin chars only)
        self._font_added = True

    def set_font(self, family, style="", size=0):
        # Always use the family set on init; allow overrides
        super().set_font(family, style, size)

    # ── Page decorations ─────────────────────────────────────────────────────
    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*rgb(GREEN))
        self.rect(0, 0, 210, 5, "F")
        self.set_y(9)
        super().set_font("Helvetica", "I", 7)
        self.set_text_color(*rgb(MUTED))
        self.cell(0, 4, "Proposta Comercial - Mudra for Restaurants", align="C",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)

    def footer(self):
        self.set_y(-14)
        super().set_font("Helvetica", "I", 7)
        self.set_text_color(*rgb(MUTED))
        self.cell(0, 5, f"Pagina {self.page_no()}", align="C")

    # ── Shorthand helpers ─────────────────────────────────────────────────────
    @property
    def cw(self):
        return 210 - self.ML - self.MR

    def F(self, size=9.5, bold=False, italic=False):
        style = ("B" if bold else "") + ("I" if italic else "")
        super().set_font("Helvetica", style, size)

    def rule(self, color=RULE_C, lw=0.3):
        self.set_draw_color(*rgb(color))
        self.set_line_width(lw)
        x = self.ML
        y = self.get_y()
        self.line(x, y, 210 - self.MR, y)
        self.ln(3)

    def section_title(self, number, title):
        self.ln(5)
        x, y = self.get_x(), self.get_y()
        self.set_fill_color(*rgb(GREEN))
        self.rect(x - 1, y, 3, 7, "F")
        self.set_x(x + 4)
        self.F(11, bold=True)
        self.set_text_color(*rgb(GREEN))
        self.cell(0, 7, f"{number}. {title.upper()}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*rgb(DARK))
        self.ln(1)

    def body(self, text, size=9.5, color=DARK, indent=0):
        self.set_x(self.ML + indent)
        self.F(size)
        self.set_text_color(*rgb(color))
        self.multi_cell(self.cw - indent, 5.2, text,
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def bold_line(self, text, size=9.5):
        self.F(size, bold=True)
        self.set_text_color(*rgb(DARK))
        self.cell(0, 5, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def kv(self, label, value, lw=55):
        self.F(9, bold=True)
        self.set_text_color(*rgb(MUTED))
        self.cell(lw, 5.5, label)
        self.F(9)
        self.set_text_color(*rgb(DARK))
        self.cell(0, 5.5, value, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def table(self, headers, rows, widths, right_cols=None):
        right_cols = right_cols or []
        rh = 6.5
        # header row
        self.set_fill_color(*rgb(THEAD))
        self.F(8.5, bold=True)
        self.set_text_color(*rgb(GREEN))
        for i, (h, w) in enumerate(zip(headers, widths)):
            self.cell(w, rh, h, border="B", fill=True,
                      align="R" if i in right_cols else "L")
        self.ln()
        # data rows
        self.set_text_color(*rgb(DARK))
        for ri, row in enumerate(rows):
            is_total = any(str(c).strip().startswith("**") for c in row)
            fill = is_total or ri % 2 == 1
            if is_total:
                self.set_fill_color(*rgb(GREEN_L))
                self.F(8.5, bold=True)
            elif ri % 2 == 1:
                self.set_fill_color(*rgb(STRIPE))
                self.F(8.5)
            else:
                self.set_fill_color(*rgb(WHITE))
                self.F(8.5)
            for i, (cell, w) in enumerate(zip(row, widths)):
                txt = str(cell).replace("**", "")
                self.cell(w, rh, txt, fill=fill,
                          align="R" if i in right_cols else "L")
            self.ln()
        self.ln(3)

    def note_box(self, text):
        self.set_fill_color(*rgb(GREEN_L))
        self.set_draw_color(*rgb(GREEN))
        self.set_line_width(0.4)
        x, y = self.get_x(), self.get_y()
        # measure text height
        self.F(8.5, italic=True)
        lines_n = max(len(text) // 95 + text.count("\n") + 1, 2)
        h = lines_n * 5 + 8
        self.rect(x, y, self.cw, h, "DF")
        self.set_xy(x + 4, y + 3)
        self.set_text_color(*rgb(GREEN))
        self.multi_cell(self.cw - 8, 5, text,
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*rgb(DARK))
        self.ln(2)

    def sig_block(self, title):
        self.ln(8)
        self.F(9.5, bold=True)
        self.set_text_color(*rgb(DARK))
        self.cell(0, 5, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)
        self.body("Nome: ___________________________________________")
        self.body("CPF/CNPJ: _______________________________________")
        self.body("Assinatura:")
        self.ln(10)
        x, y = self.get_x(), self.get_y()
        self.set_draw_color(*rgb(RULE_C))
        self.set_line_width(0.4)
        self.line(x, y, x + 120, y)
        self.ln(8)


# ══════════════════════════════════════════════════════════════════════════════
pdf = PDF()
pdf.add_page()

# ── CAPA ──────────────────────────────────────────────────────────────────────
pdf.set_fill_color(*rgb(GREEN))
pdf.rect(0, 0, 210, 44, "F")

pdf.set_y(11)
pdf.F(22, bold=True)
pdf.set_text_color(*rgb(WHITE))
pdf.cell(0, 10, "PROPOSTA COMERCIAL", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.F(11)
pdf.cell(0, 7, "Desenvolvimento de Sistema de Gestao para Restaurantes",
         align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.set_y(52)
pdf.set_text_color(*rgb(DARK))
pdf.kv("Data:", "Novembro de 2026")
pdf.kv("Validade:", "15 dias")
pdf.ln(5)
pdf.rule()
pdf.kv("CONTRATANTE:", "__________________________________________")
pdf.ln(2)
pdf.kv("CONTRATADO:",  "___________________________________________")
pdf.ln(4)
pdf.rule()

# ── 1. OBJETIVO ───────────────────────────────────────────────────────────────
pdf.section_title("1", "Objetivo do Projeto")
pdf.body(
    "Desenvolvimento de um sistema de gestao operacional para restaurantes, "
    "contemplando gerenciamento de usuarios, cardapio, mesas, comandas, pedidos, "
    "cozinha, caixa e sincronizacao de informacoes em tempo real.\n\n"
    "A solucao sera desenvolvida considerando a possibilidade de operacao em "
    "ambientes com instabilidade de conexao a internet, utilizando uma estrutura "
    "hibrida entre nuvem e infraestrutura local."
)

# ── 2. ESCOPO ─────────────────────────────────────────────────────────────────
pdf.section_title("2", "Escopo e Estimativa de Desenvolvimento")

etapas = [
    ("Arquitetura, requisitos e setup",         "15h"),
    ("Autenticacao e permissoes",               "15h"),
    ("Gestao de usuarios e funcionarios",       "10h"),
    ("Cardapio e categorias",                   "20h"),
    ("Mesas e salao",                           "20h"),
    ("Comandas e pedidos",                      "30h"),
    ("Cozinha e painel de preparo (KDS)",        "20h"),
    ("Caixa e fechamento de contas",            "25h"),
    ("Socket.IO e sincronizacao",               "20h"),
    ("Relatorios e historico",                  "15h"),
    ("Deploy e infraestrutura",                 "10h"),
    ("Testes e correcoes",                      "25h"),
    ("Homologacao no restaurante",              "15h"),
    ("**Total estimado**",                      "**240h**"),
]
pdf.table(["Etapa", "Horas"], etapas, [145, 29], right_cols=[1])

pdf.ln(1)
pdf.bold_line("Valor da hora de desenvolvimento: R$ 20,00")
pdf.ln(3)

pdf.set_fill_color(*rgb(GREEN))
pdf.F(10, bold=True)
pdf.set_text_color(*rgb(WHITE))
pdf.cell(pdf.cw, 8, "  Investimento total em desenvolvimento: R$ 4.800,00",
         fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*rgb(DARK))
pdf.ln(2)

# ── 3. FERRAMENTAS E EQUIPAMENTOS ─────────────────────────────────────────────
pdf.section_title("3", "Investimento Inicial em Ferramentas e Equipamentos")

itens = [
    ("Kiro - ferramentas de IA",
     "Apoio ao desenvolvimento (2 meses)", "R$ 120,00"),
    ("Monitor 20 pol. ou TV",
     "Exibicao do painel de cozinha (KDS)", "R$ 250,00"),
    ("Mini PC Dell Wyse 3040",
     "Infraestrutura local para contingencia offline", "R$ 450,00"),
    ("**Total**", "", "**R$ 820,00**"),
]
pdf.table(["Item", "Finalidade", "Valor"], itens, [62, 82, 30], right_cols=[2])

pdf.note_box(
    "Os valores dos equipamentos sao estimativas e podem sofrer alteracoes "
    "conforme disponibilidade e fornecedor. A aquisicao devera ser realizada "
    "mediante aprovacao do contratante."
)

# ── 4. CUSTOS MENSAIS ─────────────────────────────────────────────────────────
pdf.section_title("4", "Custos Mensais de Infraestrutura")

infra = [
    ("Hospedagem em nuvem - Hetzner Cloud", "R$ 80,00"),
    ("**Total mensal estimado**",           "**R$ 80,00**"),
]
pdf.table(["Servico", "Valor mensal"], infra, [145, 29], right_cols=[1])

pdf.body(
    "A hospedagem sera utilizada para manter a aplicacao e os servicos disponiveis "
    "na nuvem. O ambiente local, quando instalado e configurado, permitira maior "
    "autonomia operacional em situacoes de indisponibilidade da conexao externa."
)
pdf.note_box(
    "Os custos mensais de infraestrutura sao recorrentes e nao estao incluidos "
    "no valor do desenvolvimento."
)

# ── 5. CRONOGRAMA ─────────────────────────────────────────────────────────────
pdf.section_title("5", "Cronograma Financeiro")
pdf.body(
    "O pagamento sera dividido em tres etapas, acompanhando o avanco do "
    "desenvolvimento e a homologacao da solucao."
)
pdf.ln(2)

for mes_titulo, mes_items, mes_total, mes_valor_extra in [
    (
        "Novembro de 2026 - Desenvolvimento",
        [
            "- Conclusao da implementacao das funcionalidades previstas.",
            "- Finalizacao da estrutura principal do sistema.",
            "- Preparacao do ambiente para testes.",
        ],
        [],
        ("Pagamento: 40% do desenvolvimento\nValor: R$ 1.920,00", None),
    ),
    (
        "Dezembro de 2026 - Primeiros Testes e Infraestrutura",
        [
            "- Inicio dos testes operacionais.",
            "- Instalacao e configuracao da infraestrutura local.",
            "- Preparacao do painel de cozinha.",
            "- Configuracao da hospedagem em nuvem.",
        ],
        [
            ("Hospedagem em nuvem", "R$ 80,00"),
            ("Mini PC",             "R$ 450,00"),
            ("Monitor ou TV",       "R$ 250,00"),
            ("**Total**",           "**R$ 780,00**"),
        ],
        None,
    ),
    (
        "Janeiro de 2027 - Fase Final e Entrega",
        [
            "- Testes finais de estabilidade e sincronizacao.",
            "- Correcoes identificadas durante a homologacao.",
            "- Validacao do funcionamento no restaurante.",
            "- Entrega da solucao.",
        ],
        [
            ("Hospedagem em nuvem",          "R$ 80,00"),
            ("Saldo de desenvolvimento (60%)", "R$ 2.880,00"),
            ("**Total**",                    "**R$ 2.960,00**"),
        ],
        None,
    ),
]:
    pdf.F(9.5, bold=True)
    pdf.set_text_color(*rgb(GREEN))
    pdf.cell(0, 6, mes_titulo, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*rgb(DARK))
    for item in mes_items:
        pdf.body(item, indent=4)
    pdf.ln(1)
    if mes_total:
        pdf.table(["Despesa", "Valor"], mes_total, [145, 29], right_cols=[1])
    if mes_valor_extra:
        texto, _ = mes_valor_extra
        for linha in texto.split("\n"):
            pdf.bold_line(linha)
        pdf.ln(3)

# ── 6. RESUMO GERAL ───────────────────────────────────────────────────────────
pdf.section_title("6", "Resumo Geral do Investimento")

resumo = [
    ("Desenvolvimento do sistema (240h)", "R$ 4.800,00"),
    ("Ferramentas de desenvolvimento",    "R$ 120,00"),
    ("Equipamentos (Mini PC + monitor)",  "R$ 700,00"),
    ("Hospedagem (3 meses estimados)",    "R$ 240,00"),
    ("**Investimento total estimado**",   "**R$ 5.860,00**"),
]
pdf.table(["Descricao", "Valor"], resumo, [145, 29], right_cols=[1])

pdf.bold_line("Distribuicao dos pagamentos")
pdf.ln(2)

pagamentos = [
    ("Novembro/2026", "R$ 1.920,00"),
    ("Dezembro/2026", "R$ 780,00"),
    ("Janeiro/2027",  "R$ 2.960,00"),
    ("**Total**",     "**R$ 5.660,00**"),
]
pdf.table(["Periodo", "Valor"], pagamentos, [145, 29], right_cols=[1])

pdf.note_box(
    "Observacao: o total de R$ 5.860,00 considera tambem os R$ 120,00 das "
    "ferramentas de desenvolvimento, que nao estao alocados no cronograma "
    "mensal acima. Caso aprovadas, deverao ser provisionadas separadamente."
)

# ── 7. CONDICOES GERAIS ───────────────────────────────────────────────────────
pdf.section_title("7", "Condicoes Gerais")

condicoes = [
    ("1.", "O desenvolvimento seguira o escopo funcional e a estimativa de horas apresentados nesta proposta."),
    ("2.", "Solicitacoes de novas funcionalidades ou alteracoes significativas de escopo poderao ser avaliadas e orcadas separadamente."),
    ("3.", "Os equipamentos serao adquiridos mediante aprovacao do contratante."),
    ("4.", "Os custos de hospedagem e demais servicos de terceiros sao recorrentes e de responsabilidade do contratante, salvo acordo diferente entre as partes."),
    ("5.", "O prazo estimado de execucao contempla as etapas de desenvolvimento, testes e homologacao entre novembro de 2026 e janeiro de 2027."),
    ("6.", "A entrega sera realizada apos a conclusao dos testes e validacao operacional no estabelecimento."),
]
for num, texto in condicoes:
    pdf.set_x(pdf.ML)
    pdf.F(9, bold=True)
    pdf.set_text_color(*rgb(GREEN))
    pdf.cell(8, 5.5, num)
    pdf.F(9)
    pdf.set_text_color(*rgb(DARK))
    pdf.multi_cell(pdf.cw - 8, 5.2, texto,
                   new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1)

# ── 8. APROVACAO ──────────────────────────────────────────────────────────────
pdf.section_title("8", "Aprovacao da Proposta")
pdf.body(
    "Ao assinar este documento, as partes declaram estar de acordo com o escopo, "
    "os valores estimados, o cronograma financeiro e as condicoes gerais apresentados."
)
pdf.ln(4)
pdf.body("Local e data: __________________________________________")

pdf.sig_block("CONTRATANTE")
pdf.sig_block("CONTRATADO")

pdf.rule(color=RULE_C, lw=0.2)
pdf.body(
    "Proposta comercial - Desenvolvimento de Sistema de Gestao para Restaurantes.",
    color=MUTED, size=8
)

# ── OUTPUT ────────────────────────────────────────────────────────────────────
out = r"c:\Software\mudra-for-restaurants\proposta-comercial.pdf"
pdf.output(out)
print(f"PDF gerado com sucesso: {out}")
