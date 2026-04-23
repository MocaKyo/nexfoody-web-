export interface LojaVisual {
  corPrimaria:      string;   // botão pedir, destaques
  corAcento:        string;   // hover, links, bordas ativas
  corHeader:        string;   // fundo do cabeçalho
  corFundo:         string;   // fundo geral da loja
  bannerGradiente:  boolean;  // usa gradiente ou cor sólida no banner
  bannerCorA:       string;   // cor início do gradiente
  bannerCorB:       string;   // cor fim do gradiente
  bannerDirecao:    string;   // ex: "135deg"
  fonte:            string;   // "Outfit" | "Fraunces" | "Inter" | "Poppins"
  bordaArredondada: boolean;  // cards com borda mais arredondada
  // Tema base: dark = fundo escuro | light = fundo claro | white = fundo branco puro
  temaBase:         "dark" | "light" | "white";
  // Nav e topbar custom (calculado automaticamente a partir do temaBase)
  navBg?:           string;
  navBorder?:       string;
  navTexto?:        string;
  topbarBg?:        string;
  topbarTexto?:     string;
}

export const VISUAL_PADRAO: LojaVisual = {
  corPrimaria:      "#f5c518",
  corAcento:        "#7c3aed",
  corHeader:        "#1a0a36",
  corFundo:         "#080412",
  bannerGradiente:  true,
  bannerCorA:       "#1a0a36",
  bannerCorB:       "#0f0518",
  bannerDirecao:    "135deg",
  fonte:            "Outfit",
  bordaArredondada: true,
  temaBase:         "dark",
};

export interface TenantConfig {
  tenantId: string;
  nomeLoja: string;
  logoUrl: string;
  imagemCapa: string;
  horario: string;
  whatsapp: string;
  pixKey: string;
  nomeRecebedorPix: string;
  cidadePix: string;
  pontosPorReal: number;
  endereco: string;
  mensagemPausa: string;
  instagram: string;
  paginaFeed: string;
  cardapioAtivo: boolean;
  pausaManual: boolean;
  horarioAutomatico: boolean;
  horarioAbertura: string;
  horarioFechamento: string;
  suporteAtivo: boolean;
  tempoMin: number;
  tempoMax: number;
  tema: "dark" | "light";
  ativo: boolean;
  chamadoCupom: string[];
  rankingPtsComentario: number;
  rankingPtsPedido: number;
  rankingPtsPorReal: number;
  metaFaturamento?: number;
  taxaEntrega?: number;
  exibirLogoFeed?: boolean;
  logoFeed?: string;
  visual?: Partial<LojaVisual>;
  cashbackPercent?: number;
  cashbackMaxPedido?: number;
  modoFidelidade?: "pontos" | "cashback" | "ambos";
}

export interface LojaMeta {
  tenantId: string;
  nome: string;
  slug: string;
  logo: string;
  capa: string;
  categoria: string;
  desc: string;
  ativo: boolean;
  ownerId: string;
  createdAt: unknown;
}

export interface TenantContextValue {
  tenantId: string | null;
  tenantConfig: TenantConfig | null;
  isLoading: boolean;
  isValidTenant: boolean;
}

export interface UserData {
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  photoURL: string | null;
  pontos: number;
  rankingPts: number;
  cashback: number;
  role: "cliente" | "lojista" | "admin" | "funcionario";
  following: string[];
  createdAt: unknown;
  favoritos: string[];
  tenantId?: string;
  papel?: string;
  criadoPor?: string;
  lojistaOf?: string;
  endereco?: string;
  contatosEmergencia?: Array<{ nome: string; telefone: string; tipo: "familiar" | "amigo" | "outro" }>;
  queroProvar?: Record<string, {
    produtoId: string;
    nome: string;
    foto?: string | null;
    preco: number;
    lojaSlug: string;
    adicionandoEm?: string;
  }>;
}

export interface Pedido {
  id: string;
  userId: string;
  userNome: string;
  telefone: string;
  items: PedidoItem[];
  observacao: string;
  endereco: string;
  subtotal: number;
  taxaEntrega: number;
  total: number;
  status: PedidoStatus;
  createdAt: unknown;
  tenantId: string;
  pontosGanhos?: number;
}

export type PedidoStatus = "pendente" | "confirmado" | "preparo" | "pronto" | "entrega" | "entregue" | "cancelado";

export interface PedidoItem {
  produtoId: string;
  produtoNome: string;
  qty: number;
  precoUnit: number;
  precoTotal: number;
  foto?: string;
  complementos?: Array<{ nome: string; preco: number }>;
  obs?: string;
}

export interface Cupom {
  id: string;
  nome?: string;
  codigo: string;
  desconto: number | string;
  ativo: boolean;
  dataExpiracao?: { toDate: () => Date } | string;
  createdAt: unknown;
}

export interface Post {
  id: string;
  tipo: "promo" | "novidade" | "aviso";
  texto: string;
  foto?: string;
  createdAt: { toDate: () => Date };
}

export interface Recompensa {
  id: string;
  nome: string;
  emoji?: string;
  pontos: number;
}

export interface Sorteio {
  id: string;
  nome: string;
  descricao: string;
  dataSorteio: { toDate: () => Date };
  premio: string;
  winnerId?: string;
  winnerNome?: string;
  participantesCount?: number;
  foto?: string;
}

export interface Produto {
  id: string;
  nome: string;
  desc?: string;
  preco: number;
  foto?: string;
  emoji?: string;
  categoria?: string;
  ativo?: boolean;
  estoque?: number;
  comentariosCount?: number;
  [key: string]: unknown;
}

export interface RankingEntry {
  id: string;
  rankingPts: number;
  pontos?: number;
  nome: string;
  foto?: string;
  posicao: number;
}
