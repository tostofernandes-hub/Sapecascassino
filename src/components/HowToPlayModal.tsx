import React from 'react';
import { X, HelpCircle, BookOpen, CheckCircle2 } from 'lucide-react';
import { GameId } from '../types/casino';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: GameId;
  customPayouts?: { label: string; value: string }[];
}

interface GameRuleData {
  title: string;
  subtitle: string;
  objective: string;
  steps: string[];
  payouts: { label: string; value: string }[];
  tips: string[];
}

const RULES: Record<string, GameRuleData> = {
  blackjack: {
    title: 'Blackjack (21)',
    subtitle: 'Derrote a mão do Dealer sem ultrapassar 21 pontos',
    objective: 'Obter uma pontuação mais próxima de 21 do que o Dealer sem ultrapassar 21.',
    steps: [
      'Você e o Dealer recebem 2 cartas (uma carta do dealer fica oculta).',
      'Ás vale 1 ou 11 pontos; cartas 10, J, Q e K valem 10 pontos; números de 2 a 9 mantêm seu valor.',
      'Clique em "Pedir Carta (Hit)" para receber mais cartas até estar satisfeito.',
      'Clique em "Parar (Stand)" para encerrar sua vez e passar a rodada para o Dealer.',
      'Se suas duas primeiras cartas somarem um bom total e tiver saldo, você pode "Dobrar (Double Down)" para dobrar a aposta e receber apenas mais uma carta.',
      'O Dealer é obrigado a comprar cartas até atingir pelo menos 17 pontos.'
    ],
    payouts: [
      { label: 'Blackjack Natural (21 com 2 cartas)', value: '3 : 2 (1,5x o lucro)' },
      { label: 'Vitória Comum (Pontuação maior que a do Dealer)', value: '1 : 1' },
      { label: 'Empate (Push)', value: 'Aposta devolvida' },
      { label: 'Estourar (Bust > 21)', value: 'Perde a aposta' }
    ],
    tips: [
      'Pare sempre que tiver 17 ou mais para evitar estourar.',
      'Se o Dealer mostrar uma carta fraca (4, 5 ou 6), seja mais conservador pois a chance dele estourar é alta.'
    ]
  },
  'texas-holdem': {
    title: "Pôquer Texas Hold'em",
    subtitle: 'Enfrente a casa no jogo de pôquer mais famoso do mundo',
    objective: 'Formar a melhor combinação de 5 cartas usando suas 2 cartas fechadas e as 5 cartas comunitárias da mesa.',
    steps: [
      'Faça sua aposta Ante inicial para receber 2 cartas fechadas e a casa também recebe 2 cartas ocultas.',
      'A mesa revela as 3 primeiras cartas comunitárias (o Flop). Você pode Pagar (Call) para continuar ou Aumentar (Raise) ou Desistir (Fold).',
      'Em seguida a mesa revela a 4ª carta (o Turn). Você decide novamente suas ações.',
      'A 5ª e última carta (o River) é revelada.',
      'No Showdown final, as cartas da casa são reveladas. O sistema compara a melhor mão de 5 cartas de cada lado.'
    ],
    payouts: [
      { label: 'Royal Flush', value: '100 : 1' },
      { label: 'Straight Flush', value: '40 : 1' },
      { label: 'Quadra (Four of a Kind)', value: '20 : 1' },
      { label: 'Full House', value: '7 : 1' },
      { label: 'Flush (Cor)', value: '5 : 1' },
      { label: 'Straight (Sequência)', value: '4 : 1' },
      { label: 'Trinca / Dois Pares / Um Par / Carta Alta', value: '1 : 1' }
    ],
    tips: [
      'Pares altos (A-A, K-K, Q-Q) e conectores do mesmo naipe (A-K, K-Q suited) têm grande potencial.',
      'Observe a textura das cartas comunitárias antes de aumentar.'
    ]
  },
  'roulette-american': {
    title: 'Roleta Americana (0 & 00)',
    subtitle: 'Roda americana de 38 casas (0, 00 e 1 a 36) com múltiplas opções de aposta',
    objective: 'Prever em qual número ou grupo de números a bola da roleta vai pousar.',
    steps: [
      'Escolha o valor da sua ficha e clique nos setores da mesa para posicionar suas apostas.',
      'Você pode apostar em números individuais (0, 00 e 1 a 36) ou apostas externas (Cores, Par/Ímpar, Dúzias, etc.).',
      'Clique em "Girar Roleta" para iniciar a roda e acompanhar a desaceleração da esfera.',
      'O número sorteado é destacado e todos os pagamentos vencedores são creditados no seu saldo.'
    ],
    payouts: [
      { label: 'Número Pleno (0, 00 ou 1 a 36)', value: '35 : 1' },
      { label: 'Dúzias (1-12, 13-24, 25-36)', value: '2 : 1' },
      { label: 'Vermelho / Preto', value: '1 : 1' },
      { label: 'Par / Ímpar', value: '1 : 1' },
      { label: 'Baixo (1-18) / Alto (19-36)', value: '1 : 1' }
    ],
    tips: [
      'Os números 0 e 00 são verdes e não contam como par/ímpar, alto/baixo nem vermelho/preto.',
      'Apostas externas (como Vermelho ou Par) oferecem pagamentos consistentes de 1:1.'
    ]
  },
  'video-poker': {
    title: 'Vídeo Pôquer (Jacks or Better)',
    subtitle: 'Estratégia de 5 cartas com trocas e tabela de multiplicadores',
    objective: 'Obter uma mão final de 5 cartas de valor igual ou superior a um Par de Valetes.',
    steps: [
      'Defina o valor da aposta e clique em "Distribuir 5 Cartas".',
      'Analise sua mão e clique nas cartas que deseja MANTER (elas recebem a marcação MANTER).',
      'Clique em "Trocar e Avaliar Mão" para descartar as cartas restantes e receber substitutas.',
      'Sua mão final é classificada e os prêmios são pagos de acordo com a tabela exibida no topo.'
    ],
    payouts: [
      { label: 'Royal Flush (10, J, Q, K, A do mesmo naipe)', value: '250x' },
      { label: 'Straight Flush (Sequência do mesmo naipe)', value: '50x' },
      { label: 'Quadra (4 cartas iguais)', value: '25x' },
      { label: 'Full House (Trinca + Par)', value: '9x' },
      { label: 'Flush (5 cartas do mesmo naipe)', value: '6x' },
      { label: 'Sequência (5 números consecutivos)', value: '4x' },
      { label: 'Trinca (3 cartas iguais)', value: '3x' },
      { label: 'Dois Pares distintos', value: '2x' },
      { label: 'Par de Valetes, Damas, Reis ou Áses', value: '1x (Devolve aposta)' }
    ],
    tips: [
      'Pares baixos (ex: 2 a 10) não pagam sozinhos, mas vale a pena mantê-los para tentar trinca ou dois pares.',
      'Se receber 4 cartas para um flush ou straight aberto, mantenha-as para tentar completar a sequência.'
    ]
  },
  baccarat: {
    title: 'Bacarate (Punto Banco)',
    subtitle: 'O elegante duelo entre a mão do Jogador e da Banca',
    objective: 'Apostar em qual dos dois lados (Jogador ou Banca) terminará com a pontuação mais próxima de 9, ou se haverá Empate.',
    steps: [
      'Escolha se deseja apostar no Jogador (Player), na Banca (Banker) ou no Empate (Tie).',
      'São distribuídas 2 cartas para cada lado.',
      'Pontuação: Ás vale 1 ponto; 10, J, Q e K valem 0 pontos; números de 2 a 9 mantêm seu valor. A soma é sempre calculada no módulo 10 (ex: 7 + 8 = 15 -> vale 5 pontos).',
      'Se qualquer lado somar 8 ou 9 com as duas primeiras cartas, é um "Natural" e a mão encerra.',
      'Caso contrário, as regras tradicionais da 3ª carta determinam se Jogador ou Banca compram mais uma carta.'
    ],
    payouts: [
      { label: 'Jogador (Player)', value: '1 : 1' },
      { label: 'Banca (Banker)', value: '0,95 : 1 (comissão de 5%)' },
      { label: 'Empate (Tie)', value: '8 : 1' }
    ],
    tips: [
      'Estatisticamente, a aposta na Banca possui a menor margem da casa no cassino.',
      'Se der Empate e você tiver apostado no Jogador ou na Banca, sua aposta é devolvida integralmente!'
    ]
  },
  slots: {
    title: 'Caça-Níquel Fortune (Tigrinho)',
    subtitle: 'Bobinas 3x3 com multiplicadores nas 8 linhas de pagamento',
    objective: 'Alinhar exatamente 3 símbolos idênticos em qualquer uma das 8 linhas de pagamento (horizontais, verticais ou diagonais).',
    steps: [
      'Escolha o valor da aposta usando o seletor de fichas.',
      'A cada giro, você pode jogar com temas aleatórios (Tigrinho, Frutas 777, Egito, Espaço, Oceano) ou escolher seu tema favorito no botão de alternância.',
      'Clique em "Girar Caça-Níquel" para acionar as bobinas com efeito de blur e parada sequencial.',
      'As 8 linhas válidas são: 3 linhas horizontais, 3 linhas verticais e 2 diagonais.',
      'Linhas vencedoras piscam e multiplicam o valor da aposta conforme a raridade do símbolo.'
    ],
    payouts: [
      { label: 'Símbolo Principal / Jackpot (ex: Tigre Dourado, 777, Faraó)', value: '50x por linha' },
      { label: 'Símbolo Nível 2 (ex: Dragão, Diamante, Olho de Hórus)', value: '25x' },
      { label: 'Símbolo Nível 3 (ex: Sapo da Fortuna, Sino, Escaravelho)', value: '15x' },
      { label: 'Símbolo Nível 4 (ex: Moeda de Ouro, Melancia, Pirâmide)', value: '10x' },
      { label: 'Símbolo Nível 5 (ex: Panda, Uva, Anúbis)', value: '5x' },
      { label: 'Símbolo Nível 6 (ex: Bambu, Cereja, Ânfora)', value: '3x' }
    ],
    tips: [
      'Como são 5 linhas de pagamento, você pode acertar múltiplas linhas no mesmo giro e somar todos os multiplicadores!'
    ]
  },
  lottery: {
    title: 'Loteria Mega Imperial',
    subtitle: 'Sorteio de 6 dezenas no estilo Mega-Sena',
    objective: 'Escolher entre 6 e 15 números no volante de 1 a 60 e acertar 4, 5 ou 6 dezenas sorteadas.',
    steps: [
      'Clique nos números de 1 a 60 no volante para montar seu jogo (mínimo de 6 e máximo de 15 números).',
      'Ou use o botão "Surpresinha" para que o sistema escolha 6 números aleatórios instantaneamente.',
      'Defina o valor base da sua aposta. Apostas com mais de 6 números têm seu custo calculado proporcionalmente às combinações possíveis.',
      'Clique em "Apostar e Sortear" para acompanhar a revelação emocionante das 6 bolas que saem do globo.',
      'Os acertos são comparados e destacados na tela.'
    ],
    payouts: [
      { label: 'Sena (6 acertos)', value: '50.000x a aposta base' },
      { label: 'Quina (5 acertos)', value: '1.500x a aposta base' },
      { label: 'Quadra (4 acertos)', value: '50x a aposta base' },
      { label: 'Menos de 4 acertos', value: 'Sem premiação' }
    ],
    tips: [
      'Jogar mais números aumenta substancialmente as chances estatísticas de pontuar nas faixas de Quadra e Quina.'
    ]
  },
  craps: {
    title: 'Craps (Dados de Cassino)',
    subtitle: 'O clássico jogo de dados de Las Vegas com apostas de alta emoção',
    objective: 'Prever a soma dos dois dados lançados na mesa de Craps.',
    steps: [
      'Escolha uma das áreas de aposta: Pass Line, Don\'t Pass, Field, Qualquer 7, Craps ou Hard 8.',
      'Defina o valor da aposta com suas fichas e clique em "Rolar Dados".',
      'Dois dados 3D são rolados na mesa.',
      'A soma dos dados determina a vitória conforme as regras clássicas de Craps.'
    ],
    payouts: [
      { label: 'Pass Line (Ganha no 7 e 11)', value: '1 : 1' },
      { label: "Don't Pass (Ganha no 2 e 3)", value: '1 : 1' },
      { label: 'Field (Somas 3, 4, 9, 10, 11)', value: '1 : 1' },
      { label: 'Field Especial (Somas 2 ou 12)', value: '2 : 1' },
      { label: 'Qualquer 7', value: '4 : 1' },
      { label: 'Craps Especial (2, 3 ou 12)', value: '7 : 1' },
      { label: 'Hard 8 (Dois 4 idênticos)', value: '9 : 1' }
    ],
    tips: [
      'A aposta Pass Line é uma das mais tradicionais e seguras para começar em mesas de dados.'
    ]
  },
  scratch: {
    title: 'Raspadinha Sapeca',
    subtitle: 'Raspe os 9 quadrantes independentes e encontre 3 símbolos idênticos para faturar até 100x',
    objective: 'Revelar todos os 9 quadrados da grade 3x3 e encontrar 3 símbolos idênticos.',
    steps: [
      'Escolha o valor do bilhete e clique em "Comprar Bilhete".',
      'Passe o mouse ou o dedo sobre cada um dos 9 quadrados de forma independente para revelar seu símbolo.',
      'A rodada só termina quando todos os 9 quadrados estiverem raspados. Se houver 3 símbolos iguais, você ganha o multiplicador correspondente!'
    ],
    payouts: [
      { label: '3x Coroa Imperial 👑', value: '100x a aposta' },
      { label: '3x Diamante 💎', value: '50x a aposta' },
      { label: '3x 777 Ouro 7️⃣', value: '25x a aposta' },
      { label: '3x Moedas de Ouro 🪙', value: '10x a aposta' },
      { label: '3x Cerejas 🍒', value: '5x a aposta' },
      { label: '3x Trevo da Sorte 🍀', value: '2x a aposta' }
    ],
    tips: [
      'Você pode raspar quadrado por quadrado no seu ritmo — não há limite de tempo.'
    ]
  },
  coinflip: {
    title: 'Cara ou Coroa 3D (Jogo Justo 50/50)',
    subtitle: 'Pura sorte sem vantagem da casa: chance justa de 50%',
    objective: 'Adivinhar se a moeda imperial de ouro vai cair em Cara ou Coroa.',
    steps: [
      'Escolha entre Cara (Leão Imperial) ou Coroa (Coroa Dourada).',
      'Defina o valor da aposta com suas fichas.',
      'Clique em "Lançar Moeda" e assista à moeda girar em 3D no ar.',
      'Se acertar, dobra sua aposta (1:1 payout). Sequências de vitórias são registradas.'
    ],
    payouts: [
      { label: 'Acerto de Lado', value: '1 : 1 (2x a aposta)' },
      { label: 'Chance Estatística', value: '50.0% (Totalmente Justo)' }
    ],
    tips: [
      'Este é um dos jogos justos do cassino mantido sem vantagem da casa, ideal para quem busca chances equilibradas.'
    ]
  },
  sicbo: {
    title: 'Sic Bo · Dados Imperial',
    subtitle: 'Jogo oriental de 3 dados com apostas em Pequeno, Grande e Trincas',
    objective: 'Prever o resultado e a soma dos 3 dados agitados na cúpula.',
    steps: [
      'Selecione sua aposta: Pequeno (4 a 10), Grande (11 a 17), Par, Ímpar ou Trincas.',
      'Defina o valor da aposta e clique em "Sacudir Dados".',
      'A cúpula sacode e revela os 3 dados.',
      'Atenção: Qualquer trinca (ex: 2-2-2) faz apostas em Pequeno e Grande perderem.'
    ],
    payouts: [
      { label: 'Pequeno (Soma 4 a 10)', value: '1 : 1' },
      { label: 'Grande (Soma 11 a 17)', value: '1 : 1' },
      { label: 'Soma Par / Ímpar', value: '1 : 1' },
      { label: 'Qualquer Trinca', value: '30 : 1' },
      { label: 'Trinca Real de 6 (6-6-6)', value: '150 : 1' }
    ],
    tips: [
      'Pequeno e Grande oferecem chances de vitória próximas de 48.6%, tornando-as as apostas mais consistentes.'
    ]
  },
  miner: {
    title: 'Miner Sapeca',
    subtitle: 'Encontre diamantes esmeralda e decida a hora certa de sacar antes de detonar uma bomba vermelha',
    objective: 'Revelar células com diamantes para acumular multiplicadores e realizar o saque antes de acertar qualquer bomba.',
    steps: [
      'Escolha a quantidade de bombas na grade (1, 3, 5, 10 ou 24 bombas).',
      'Defina o valor da aposta e clique em "Iniciar Campo Minado".',
      'Clique nas células da grade 5x5. Cada diamante revelado aumenta seu multiplicador.',
      'Clique em "Sacar Fichas" a qualquer momento para resgatar seus lucros.',
      'Se acertar uma bomba, ela explode e a aposta é perdida.'
    ],
    payouts: [
      { label: 'Multiplicador Inicial (1 Diamante)', value: '1.05x a 2.50x (conforme bombas)' },
      { label: 'Multiplicador Máximo', value: 'Até 24.5x' },
      { label: 'Bomba', value: 'Perda da aposta' }
    ],
    tips: [
      'Com 3 bombas na grade, retirar o prêmio com 3 a 5 diamantes oferece excelente equilíbrio entre risco e retorno.'
    ]
  },
  plinko: {
    title: 'Bolinhas Sapecas (Dificuldade 2x)',
    subtitle: 'Solte bolinhas em sequência pela pirâmide de pinos e acerte caixas multiplicadoras',
    objective: 'Soltar bolinhas pela pirâmide de pinos e acumular o maior retorno possível nas 16 caixas da base.',
    steps: [
      'Defina a aposta por bolinha e escolha quantas bolinhas soltar (1, 3, 5 ou 10).',
      'Clique em "Soltar Bolinhas" — elas caem com intervalo de 0,4s e desviam entre si.',
      'Você pode soltar mais bolinhas a qualquer momento enquanto outras ainda estão caindo.',
      'Se a soma total dos ganhos da rodada for pelo menos 2x a aposta total, a tela de vitória aparece!'
    ],
    payouts: [
      { label: 'Caixas Centrais', value: '0.6x a 0.8x' },
      { label: 'Caixas Médias', value: '1x a 3x' },
      { label: 'Caixas das Extremidades', value: '12x a 29x' }
    ],
    tips: [
      'Soltar 5 a 10 bolinhas equilibra os desvios e cria jogadas emocionantes com colisões entre as bolinhas.'
    ]
  },
  'liars-bar': {
    title: "Liar's Bar · Mesa de Blefe",
    subtitle: 'Engane seus oponentes ou desmascare blefes com cartas de figuras',
    objective: 'Ser o último jogador sobrevivente na mesa blefando ou desmascarando mentiras alheias.',
    steps: [
      'A mesa exige uma figura obrigatória (Áses, Reis ou Damas). O Diabo 😈 é carta coringa.',
      'Tempo de Turno: Você tem 10 segundos para agir (apostar, duvidar, declarar ou atirar); os Bots têm 5 segundos.',
      'Se o tempo acabar sem ação, o sistema executa uma aposta mínima automática ou dispara o gatilho.',
      'Na Roleta Russa, quem levar tiro perde 1 vida. Ao perder as 2 vidas, o jogador é eliminado e permanece na mesa como Espectador.',
      'A partida continua até restar apenas 1 jogador com vidas (ou clique em "Sair do Jogo" se for eliminado).'
    ],
    payouts: [
      { label: 'Campeão da Mesa', value: 'Leva o pote total da rodada' },
      { label: 'Tiro na Roleta Russa', value: 'Perda de 1 vida (2 tiros = Espectador)' },
      { label: 'Timer de Turno', value: '10s Jogador · 5s Bots' }
    ],
    tips: [
      'Use a carta Diabo 😈 com inteligência: ela nunca é considerada blefe quando desafiada!'
    ]
  },
  'classic-slots': {
    title: 'Caça-Níquel Clássico (3 Roletas)',
    subtitle: 'Máquina retrô estilo Las Vegas com 3 colunas em cascata',
    objective: 'Alinhar 3 símbolos iguais na linha central (ou 2 cerejas) para multiplicar sua aposta.',
    steps: [
      'Use as fichas aditivas (+10, +25, +50, +100, +500 ou Limpar) para montar sua aposta.',
      'Clique em "Girar Roletas" para acionar as 3 colunas retrô com parada em cascata.',
      'Apenas a linha central é avaliada para pagamento.',
      'Prêmios a partir de 2x exibem a tela especial de vitória com botão Recolher.'
    ],
    payouts: [
      { label: '3× Sete 7️⃣', value: '200x' },
      { label: '3× Diamante 💎', value: '100x' },
      { label: '3× BAR', value: '50x' },
      { label: '3× Sino 🔔', value: '20x' },
      { label: '3× Cereja 🍒', value: '10x' },
      { label: '3× Ferradura 🍀', value: '4x' },
      { label: '2× Cereja 🍒 na linha central', value: '2x' }
    ],
    tips: [
      'O par de cerejas (2× 🍒) agora paga 2x a sua aposta na linha central!'
    ]
  },
  'horse-race': {
    title: 'Corrida de Cavalos Sapecas',
    subtitle: 'Pista 3D em perspectiva com rotação de cavalos e cotações a cada 5 corridas',
    objective: 'Escolher o cavalo vencedor antes da largada e vê-lo cruzar a linha de chegada em 1º lugar.',
    steps: [
      'Selecione um dos 6 cavalos disponíveis na tabela de cotações.',
      'A cada 5 corridas finalizadas, os nomes e probabilidades dos cavalos mudam aleatoriamente e os multiplicadores se ajustam automaticamente.',
      'Defina o valor da aposta usando os botões de fichas (+10 a +500 ou Limpar).',
      'Clique em "Iniciar Corrida" e acompanhe o galope em 3D até a linha quadriculada.'
    ],
    payouts: [
      { label: '#1 Relâmpago (40% de chance)', value: '2.3x' },
      { label: '#2 Cometa (24% de chance)', value: '3.9x' },
      { label: '#3 Esmeralda (15% de chance)', value: '6.2x' },
      { label: '#4 Soberano (10% de chance)', value: '9.4x' },
      { label: '#5 Trovão (6% de chance)', value: '15.6x' },
      { label: '#6 Estrela (5% de chance)', value: '18.8x' }
    ],
    tips: [
      'Confira sempre a tabela de cotações antes da largada após cada rotação de 5 corridas.'
    ]
  },
  archery: {
    title: 'Tiro do Sapeca (Arqueiro)',
    subtitle: 'Escolha 1, 2 ou 3 flechas, mire nos alvos da floresta e dispare em arco 3D',
    objective: 'Selecionar os alvos certos entre os 20 disponíveis na parede e somar multiplicadores até 50x na mosca.',
    steps: [
      'Defina a aposta base nas fichas aditivas (+10 a +500 ou Limpar) e escolha 1, 2 ou 3 flechas.',
      'Regra de custo de combo: 1 flecha = 1× base (ex: 100); 2 flechas = 2,5× base (250); 3 flechas = 4,5× base (450).',
      'Clique diretamente nos alvos desejados na parede. Ao atirar, o arco 3D tensiona, dispara uma flecha a cada 0,5s e cada uma voa por 1,2s com lascas de madeira, poeira e faíscas no impacto.',
      'O prêmio de cada flecha (aposta base × multiplicador) é calculado individualmente e a soma é creditada ao saldo!'
    ],
    payouts: [
      { label: '1 Alvo na Mosca 🎯', value: '50x' },
      { label: '2 Alvos Dourados', value: '5x' },
      { label: '1 Alvo Especial', value: '2x' },
      { label: '5 Alvos Verdes', value: '1.5x' },
      { label: '3 Alvos Azuis', value: '0.5x' },
      { label: '8 Alvos Cinzas (Erro)', value: '0x' }
    ],
    tips: [
      'Todas as posições dos 20 alvos são reveladas após o último disparo da rodada para total transparência!'
    ]
  },
  'dragon-egg': {
    title: 'Ovo do Dragão Sapeca',
    subtitle: 'Ninho místico com progressão de ovos e multiplicadores a cada rodada',
    objective: 'Chocar ovos com Dragões em sequência e escolher a hora certa de sacar antes que apareça uma Cobra.',
    steps: [
      'Defina sua aposta nas fichas aditivas (+10 a +500 ou Limpar) e clique em um ovo no ninho.',
      'Rodadas 1 e 2: 5 ovos (3 Dragões / 2 Cobras) pagando 1.5x na R1 e 2.5x na R2.',
      'Rodada 3: 5 ovos (2 Dragões / 3 Cobras) pagando 4x.',
      'Rodada 4 em diante: 4 ovos (1 Dragão / 3 Cobras) pagando 6x, 10x, 15x e aumentando a cada rodada.',
      'Ao encontrar um Dragão, escolha "Sacar" para recolher o prêmio ou "Continuar" para avançar de rodada.'
    ],
    payouts: [
      { label: 'Rodada 1 (3 Dragões em 5 ovos)', value: '1.5x' },
      { label: 'Rodada 2 (3 Dragões em 5 ovos)', value: '2.5x' },
      { label: 'Rodada 3 (2 Dragões em 5 ovos)', value: '4.0x' },
      { label: 'Rodada 4 (1 Dragão em 4 ovos)', value: '6.0x' },
      { label: 'Rodada 5 (1 Dragão em 4 ovos)', value: '10.0x' },
      { label: 'Rodada 6+ (1 Dragão em 4 ovos)', value: '15.0x+' },
      { label: 'Cobra 🐍', value: 'Perde a aposta' }
    ],
    tips: [
      'Os botões Sacar e Continuar ficam sempre visíveis logo abaixo do ninho após chocar um Dragão.'
    ]
  },
  limbo: {
    title: 'Aviãozinho Sapeca (Crash)',
    subtitle: 'Decole e faça o Cash Out antes que o avião perca sustentação',
    objective: 'Multiplicar sua aposta acompanhando a subida do avião e resgatar antes da queda aleatória.',
    steps: [
      'Monte sua aposta nos botões de fichas (+10 a +500 ou Limpar) e configure o Auto Encerrar se desejar.',
      'Clique em "Decolar Avião" para iniciar o voo a partir de 1.00x.',
      'Clique em "Encerrar (Cash Out)" antes da queda para garantir o prêmio multiplicado.',
      'Resgates a partir de 2.00x exibem a tela exclusiva de vitória com o avião em 3D!'
    ],
    payouts: [
      { label: 'Multiplicador Dinâmico', value: '1.00x até 250.00x' },
      { label: 'Auto Encerrar', value: 'Resgate automático no alvo escolhido' },
      { label: 'Queda antes do resgate', value: 'Perde a aposta' }
    ],
    tips: [
      'Resgatar em multiplicadores como 2.00x ativa a tela especial de vitória e mantém o risco controlado.'
    ]
  }
};

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  isOpen,
  onClose,
  gameId,
  customPayouts
}) => {
  if (!isOpen) return null;

  const data = RULES[gameId] || RULES.blackjack;
  const payoutsToRender = customPayouts && customPayouts.length > 0 ? customPayouts : data.payouts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0e1713] border border-amber-500/40 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-amber-500/20 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-lg sm:text-xl font-bold text-amber-300 leading-tight">
                Como Jogar: {data.title}
              </h3>
              <p className="text-xs text-slate-400">
                {data.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/60 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm text-slate-300 leading-relaxed">
          {/* Objective */}
          <div>
            <h4 className="font-cinzel font-bold text-amber-400 text-xs uppercase tracking-wider mb-1.5">
              Objetivo
            </h4>
            <p className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-slate-200">
              {data.objective}
            </p>
          </div>

          {/* Steps */}
          <div>
            <h4 className="font-cinzel font-bold text-amber-400 text-xs uppercase tracking-wider mb-2">
              Regras e Passo a Passo
            </h4>
            <ul className="space-y-2">
              {data.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Payouts */}
          <div>
            <h4 className="font-cinzel font-bold text-amber-400 text-xs uppercase tracking-wider mb-2">
              Tabela de Pagamentos
            </h4>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 text-xs">
              {payoutsToRender.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5">
                  <span className="text-slate-300 font-medium">{p.label}</span>
                  <span className="font-mono font-bold text-amber-400 text-right">{p.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          {data.tips.length > 0 && (
            <div>
              <h4 className="font-cinzel font-bold text-amber-400 text-xs uppercase tracking-wider mb-1.5">
                Dicas de Jogo
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
                {data.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-amber-500/20 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow transition-all cursor-pointer"
          >
            Entendido, Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
