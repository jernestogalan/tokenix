/**
 * public/js/i18n-client.js
 * Client-side i18n + FAQ Chatbot — zero AI calls, zero cost.
 *
 * Features:
 *  - 5 languages: EN, ES, PT, ZH, DE
 *  - data-i18n attribute rendering
 *  - sessionStorage persistence + navigator.language auto-detect
 *  - Language dropdown switcher in navbar
 *  - FAQ chatbot: keyword scoring (no API), contact form fallback → /api/lead
 */

/* ─────────────────────────────────────────────────────────────
   1. TRANSLATIONS
───────────────────────────────────────────────────────────── */
const TRANSLATIONS = {
  en: {
    nav: { brand:"Tokenia", analyzer:"Analyzer", pricing:"Pricing", docs:"Docs", cta:"Try Free" },
    hero: {
      badge:"Token Intelligence Platform", title:"Count Tokens.", title2:"Cut Costs.",
      subtitle:"Paste text or upload a file — get an instant token count and cost estimate across all major LLM providers.",
      cta_primary:"Start Counting", cta_secondary:"See Pricing"
    },
    stats: { models:"Models Supported", accuracy:"Accuracy", cost_savings:"Avg. Cost Savings", users:"Active Users" },
    analyzer: {
      title:"Token Analyzer", subtitle:"Instant token count & cost estimate",
      tab_text:"Paste Text", tab_file:"Upload File",
      placeholder:"Paste your prompt, document, or any text here…",
      btn_analyze:"Analyze Tokens", btn_clear:"Clear",
      upload_title:"Drop file here or click to browse",
      upload_hint:"Supports TXT, MD, PDF, DOCX, code files · Max 10 MB",
      btn_upload:"Browse File",
      result_tokens:"Tokens", result_words:"Words", result_chars:"Characters", result_cost:"Est. Cost",
      result_model:"Model", result_provider:"Provider", select_model:"Select model…",
      compare_title:"Cost Comparison",
      table_model:"Model", table_provider:"Provider", table_tokens:"Tokens", table_cost:"Cost",
      table_note_exact:"Exact", table_note_est:"Est.",
      optimize_title:"Optimization Tips", optimize_subtitle:"Reduce token usage without losing meaning",
      tip_whitespace:"Remove redundant whitespace", tip_repetition:"Eliminate repeated phrases",
      tip_compress:"Use shorthand notation", tip_chunk:"Split into smaller chunks"
    },
    features: {
      badge:"Why Tokenia", title:"Built for developers who care about costs",
      f1_title:"Exact + Estimated", f1_desc:"Official tokenizers where available (tiktoken for OpenAI, DeepSeek-V3 for DeepSeek). Clearly labeled estimates for all others.",
      f2_title:"Multi-Provider", f2_desc:"Compare costs across OpenAI, Anthropic, Mistral, Cohere, Google and more in one view.",
      f3_title:"File Upload", f3_desc:"Analyze TXT, MD, PDF, DOCX and code files. Up to 10 MB. No data stored.",
      f4_title:"RAG & Retrieval", f4_desc:"Estimate retrieval costs, chunk sizes, and embedding token budgets for your RAG pipelines.",
      f5_title:"Prompt Optimizer", f5_desc:"Get actionable tips to reduce token count while preserving the meaning of your prompts.",
      f6_title:"Always Private", f6_desc:"Text is processed in memory only. Nothing is logged, stored, or shared with third parties."
    },
    pricing: {
      badge:"Simple Pricing", title:"Start free, scale when ready", subtitle:"No credit card required for the free tier.",
      free_title:"Free", free_price:"$0", free_period:"/ forever",
      free_f1:"Unlimited token counting", free_f2:"All provider comparisons", free_f3:"File upload (TXT, MD, DOCX, PDF)",
      free_f4:"Cost estimations", free_f5:"Prompt optimizer tips", free_cta:"Get Started Free",
      pro_badge:"Most Popular", pro_title:"Pro", pro_price:"$12", pro_period:"/ month",
      pro_f1:"Everything in Free", pro_f2:"Batch processing (up to 100 files)", pro_f3:"API access",
      pro_f4:"Usage history & reports", pro_f5:"Priority support", pro_cta:"Coming Soon",
      team_title:"Team", team_price:"$49", team_period:"/ month",
      team_f1:"Everything in Pro", team_f2:"Up to 10 team members", team_f3:"Shared workspaces",
      team_f4:"Admin dashboard", team_f5:"SLA support", team_cta:"Coming Soon",
      coming_soon_note:"Upgrades coming soon — currently free for everyone."
    },
    testimonials: { badge:"What Developers Say", title:"Built for developers who care about AI costs" },
    cta: { title:"Start counting tokens for free", subtitle:"No account required. Paste text and get results instantly.", btn:"Try Tokenia Free" },
    footer: {
      tagline:"The token intelligence platform for LLM developers.",
      product:"Product", analyzer:"Analyzer", pricing:"Pricing", docs:"Docs",
      company:"Company", privacy:"Privacy Policy", terms:"Terms of Use", contact:"Contact", legal:"Legal",
      copyright:"© 2026 Tokenia. All rights reserved.",
      disclaimer:"Token counts marked “Est.” are approximations. Exact counts use official tokenizers."
    },
    chat: {
      bubble_title:"Ask Tokenia", header:"Tokenia Help",
      welcome:"Hi! I’m Tokenia’s assistant. Ask me anything about token counting, costs, or how to get started.",
      input_placeholder:"Ask a question…", btn_send:"Send", btn_close:"Close",
      quick_what:"What is Tokenia?", quick_accuracy:"How accurate?", quick_start:"How to start?", quick_cost:"Is it free?",
      fallback:"I don’t have an answer for that yet. You can reach us at info@tokenia.live and we’ll get back to you shortly.",
      fallback_form:"Or send us a message:", form_name:"Your name", form_email:"Your email",
      form_message:"Your question or message", form_submit:"Send Message",
      form_success:"Message sent! We’ll reply within 24 hours.",
      form_error:"Could not send. Please email info@tokenia.live directly.", char_limit:"characters remaining"
    }
  },

  pt: {
    nav: { brand:"Tokenia", analyzer:"Analisador", pricing:"Preços", docs:"Docs", cta:"Usar Grátis" },
    hero: {
      badge:"Plataforma de Inteligência de Tokens", title:"Conte Tokens.", title2:"Reduza Custos.",
      subtitle:"Cole texto ou envie um arquivo — obtenha contagem de tokens e estimativa de custo em todos os principais provedores de LLM instantaneamente.",
      cta_primary:"Começar Agora", cta_secondary:"Ver Funcionalidades"
    },
    stats: { models:"Modelos Suportados", accuracy:"Precisão", cost_savings:"Economia Média", users:"Usuários Ativos" },
    analyzer: {
      title:"Analisador de Tokens", subtitle:"Contagem de tokens e estimativa de custo em tempo real",
      tab_text:"Colar Texto", tab_file:"Enviar Arquivo",
      placeholder:"Cole seu prompt, documento ou qualquer texto aqui…",
      btn_analyze:"Analisar Tokens", btn_clear:"Limpar",
      upload_title:"Solte o arquivo aqui ou clique para procurar",
      upload_hint:"Suporta TXT, MD, PDF, DOCX, arquivos de código · Máx 10 MB",
      btn_upload:"Procurar Arquivo",
      result_tokens:"Tokens", result_words:"Palavras", result_chars:"Caracteres", result_cost:"Custo Est.",
      result_model:"Modelo", result_provider:"Provedor", select_model:"Selecionar modelo…",
      compare_title:"Comparação de Custos",
      table_model:"Modelo", table_provider:"Provedor", table_tokens:"Tokens", table_cost:"Custo",
      table_note_exact:"Exato", table_note_est:"Est.",
      optimize_title:"Dicas de Otimização", optimize_subtitle:"Reduza o uso de tokens sem perder significado",
      tip_whitespace:"Remover espaços redundantes", tip_repetition:"Eliminar frases repetidas",
      tip_compress:"Usar notação abreviada", tip_chunk:"Dividir em fragmentos menores"
    },
    features: {
      badge:"Por que Tokenia", title:"Criado para desenvolvedores que se preocupam com custos",
      f1_title:"Exato + Estimado", f1_desc:"Tokenizadores oficiais quando disponíveis (tiktoken para OpenAI, DeepSeek-V3 para DeepSeek). Estimativas claramente identificadas para os demais.",
      f2_title:"Múltiplos Provedores", f2_desc:"Compare custos entre OpenAI, Anthropic, Mistral, Cohere, Google e mais em uma única visualização.",
      f3_title:"Envio de Arquivos", f3_desc:"Analise TXT, MD, PDF, DOCX e arquivos de código. Até 10 MB. Nenhum dado armazenado.",
      f4_title:"RAG & Recuperação", f4_desc:"Estime custos de recuperação, tamanhos de chunks e orçamentos de tokens para seus pipelines RAG.",
      f5_title:"Otimizador de Prompts", f5_desc:"Receba dicas práticas para reduzir a contagem de tokens preservando o significado dos seus prompts.",
      f6_title:"Sempre Privado", f6_desc:"O texto é processado apenas em memória. Nada é registrado, armazenado ou compartilhado com terceiros."
    },
    pricing: {
      badge:"Gratuito Para Sempre", title:"100% grátis. Para sempre.", subtitle:"Sem cartão de crédito. Sem cadastro.",
      free_title:"Grátis", free_price:"$0", free_period:"/ para sempre",
      free_f1:"Contagem ilimitada de tokens", free_f2:"Comparação de todos os provedores", free_f3:"Envio de arquivos (TXT, MD, DOCX, PDF)",
      free_f4:"Estimativas de custo", free_f5:"Comparação lado a lado", free_cta:"Começar Agora",
      coming_soon_note:"100% grátis para sempre. Sem planos pagos."
    },
    testimonials: { badge:"O que dizem os devs", title:"Feito para devs que controlam custos de IA" },
    cta: { title:"Comece a contar tokens de graça", subtitle:"Sem conta necessária. Cole o texto e obtenha resultados instantaneamente.", btn:"Usar Tokenia Grátis" },
    footer: {
      tagline:"A calculadora de tokens mais privada para desenvolvedores de LLM. Gratuita para sempre.",
      product:"Produto", analyzer:"Analisador", pricing:"Segurança", docs:"Docs",
      company:"Empresa", privacy:"Política de Privacidade", terms:"Termos de Uso", contact:"Contato", legal:"Legal",
      copyright:"© 2026 Tokenia. Todos os direitos reservados.",
      disclaimer:"Contagens marcadas com \"Est.\" são aproximações. Contagens exatas usam tokenizadores oficiais."
    },
    chat: {
      bubble_title:"Perguntar à Tokenia", header:"Ajuda Tokenia",
      welcome:"Olá! Sou o assistente da Tokenia. Pergunte-me qualquer coisa sobre contagem de tokens, custos ou como começar.",
      input_placeholder:"Faça uma pergunta…", btn_send:"Enviar", btn_close:"Fechar",
      quick_what:"O que é Tokenia?", quick_accuracy:"Qual a precisão?", quick_start:"Como começar?", quick_cost:"É gratuito?",
      fallback:"Ainda não tenho resposta para isso. Você pode nos contatar em info@tokenia.live.",
      fallback_form:"Ou envie-nos uma mensagem:", form_name:"Seu nome", form_email:"Seu e-mail",
      form_message:"Sua pergunta ou mensagem", form_submit:"Enviar Mensagem",
      form_success:"Mensagem enviada! Responderemos em 24 horas.",
      form_error:"Não foi possível enviar. Por favor, escreva para info@tokenia.live.", char_limit:"caracteres restantes"
    }
  },

  es: {
    nav: { brand:"Tokenia", analyzer:"Analizador", pricing:"Precios", docs:"Docs", cta:"Empezar Gratis" },
    hero: {
      badge:"Plataforma de Inteligencia de Tokens", title:"Cuenta Tokens.", title2:"Reduce Costos.",
      subtitle:"Pega texto o sube un archivo — obtén conteo de tokens y estimación de costos en los principales proveedores de LLM al instante.",
      cta_primary:"Comenzar", cta_secondary:"Ver Precios"
    },
    stats: { models:"Modelos Soportados", accuracy:"Precisión", cost_savings:"Ahorro Promedio", users:"Usuarios Activos" },
    analyzer: {
      title:"Analizador de Tokens", subtitle:"Conteo de tokens y estimación de costos al instante",
      tab_text:"Pegar Texto", tab_file:"Subir Archivo",
      placeholder:"Pega tu prompt, documento o cualquier texto aquí…",
      btn_analyze:"Analizar Tokens", btn_clear:"Limpiar",
      upload_title:"Suelta el archivo aquí o haz clic para buscar",
      upload_hint:"Soporta TXT, MD, PDF, DOCX, código · Máx 10 MB",
      btn_upload:"Buscar Archivo",
      result_tokens:"Tokens", result_words:"Palabras", result_chars:"Caracteres", result_cost:"Costo Est.",
      result_model:"Modelo", result_provider:"Proveedor", select_model:"Seleccionar modelo…",
      compare_title:"Comparación de Costos",
      table_model:"Modelo", table_provider:"Proveedor", table_tokens:"Tokens", table_cost:"Costo",
      table_note_exact:"Exacto", table_note_est:"Est.",
      optimize_title:"Consejos de Optimización", optimize_subtitle:"Reduce el uso de tokens sin perder significado",
      tip_whitespace:"Eliminar espacios redundantes", tip_repetition:"Eliminar frases repetidas",
      tip_compress:"Usar notación abreviada", tip_chunk:"Dividir en fragmentos más pequeños"
    },
    features: {
      badge:"Por qué Tokenia", title:"Creado para desarrolladores que cuidan los costos",
      f1_title:"Exacto + Estimado", f1_desc:"Tokenizadores oficiales donde estén disponibles (tiktoken para OpenAI, DeepSeek-V3 para DeepSeek). Estimaciones claramente etiquetadas para los demás.",
      f2_title:"Múltiples Proveedores", f2_desc:"Compara costos entre OpenAI, Anthropic, Mistral, Cohere, Google y más en una sola vista.",
      f3_title:"Subida de Archivos", f3_desc:"Analiza TXT, MD, PDF, DOCX y archivos de código. Hasta 10 MB. Sin almacenamiento de datos.",
      f4_title:"RAG & Recuperación", f4_desc:"Estima costos de recuperación, tamaños de chunk y presupuestos de tokens de embedding para tus pipelines RAG.",
      f5_title:"Optimizador de Prompts", f5_desc:"Obtén consejos prácticos para reducir el conteo de tokens preservando el significado de tus prompts.",
      f6_title:"Siempre Privado", f6_desc:"El texto se procesa solo en memoria. Nada se registra, almacena ni comparte con terceros."
    },
    pricing: {
      badge:"Precios Simples", title:"Empieza gratis, escala cuando estés listo", subtitle:"No se requiere tarjeta de crédito para el plan gratuito.",
      free_title:"Gratis", free_price:"$0", free_period:"/ para siempre",
      free_f1:"Conteo ilimitado de tokens", free_f2:"Comparaciones de todos los proveedores", free_f3:"Subida de archivos (TXT, MD, DOCX, PDF)",
      free_f4:"Estimaciones de costos", free_f5:"Consejos del optimizador de prompts", free_cta:"Empezar Gratis",
      pro_badge:"Más Popular", pro_title:"Pro", pro_price:"$12", pro_period:"/ mes",
      pro_f1:"Todo lo de Gratis", pro_f2:"Procesamiento por lotes (hasta 100 archivos)", pro_f3:"Acceso a API",
      pro_f4:"Historial de uso e informes", pro_f5:"Soporte prioritario", pro_cta:"Próximamente",
      team_title:"Equipo", team_price:"$49", team_period:"/ mes",
      team_f1:"Todo lo de Pro", team_f2:"Hasta 10 miembros del equipo", team_f3:"Espacios de trabajo compartidos",
      team_f4:"Panel de administración", team_f5:"Soporte con SLA", team_cta:"Próximamente",
      coming_soon_note:"Actualizaciones próximamente — actualmente gratis para todos."
    },
    testimonials: { badge:"Lo que dicen los devs", title:"Para desarrolladores que controlan costos de IA" },
    cta: { title:"Comienza a contar tokens gratis", subtitle:"Sin cuenta requerida. Pega texto y obtén resultados al instante.", btn:"Probar Tokenia Gratis" },
    footer: {
      tagline:"La plataforma de inteligencia de tokens para desarrolladores de LLM.",
      product:"Producto", analyzer:"Analizador", pricing:"Precios", docs:"Docs",
      company:"Empresa", privacy:"Política de Privacidad", terms:"Términos de Uso", contact:"Contacto", legal:"Legal",
      copyright:"© 2025 Tokenia. Todos los derechos reservados.",
      disclaimer:"Los conteos marcados “Est.” son aproximaciones. Los exactos usan tokenizadores oficiales."
    },
    chat: {
      bubble_title:"Preguntar a Tokenia", header:"Ayuda de Tokenia",
      welcome:"¡Hola! Soy el asistente de Tokenia. Pregúntame sobre conteo de tokens, costos o cómo empezar.",
      input_placeholder:"Haz una pregunta…", btn_send:"Enviar", btn_close:"Cerrar",
      quick_what:"¿Qué es Tokenia?", quick_accuracy:"¿Qué tan preciso?", quick_start:"¿Cómo empezar?", quick_cost:"¿Es gratis?",
      fallback:"Aún no tengo respuesta para eso. Eschíbenos a info@tokenia.live y te respondemos pronto.",
      fallback_form:"O envíanos un mensaje:", form_name:"Tu nombre", form_email:"Tu correo",
      form_message:"Tu pregunta o mensaje", form_submit:"Enviar Mensaje",
      form_success:"¡Mensaje enviado! Te respondemos en 24 horas.",
      form_error:"No se pudo enviar. Escíbenos directamente a info@tokenia.live.", char_limit:"caracteres restantes"
    }
  },

  zh: {
    nav: { brand:"Tokenia", analyzer:"分析器", pricing:"定价", docs:"文档", cta:"免费试用" },
    hero: {
      badge:"Token 智能平台", title:"精确计算 Token。", title2:"降低 API 成本。",
      subtitle:"粘贴文本或上传文件，即时获取主流 LLM 提供商的 Token 数量和费用估算。",
      cta_primary:"开始计算", cta_secondary:"查看定价"
    },
    stats: { models:"支持模型数", accuracy:"准确率", cost_savings:"平均节省", users:"活跃用户" },
    analyzer: {
      title:"Token 分析器", subtitle:"即时 Token 计数和费用估算",
      tab_text:"粘贴文本", tab_file:"上传文件",
      placeholder:"在此粘贴提示词、文档或任何文本…",
      btn_analyze:"分析 Token", btn_clear:"清除",
      upload_title:"拖拽文件到此处或点击浏览",
      upload_hint:"支持 TXT、MD、PDF、DOCX、代码文件 · 最大 10 MB",
      btn_upload:"浏览文件",
      result_tokens:"Token 数", result_words:"词数", result_chars:"字符数", result_cost:"预估费用",
      result_model:"模型", result_provider:"提供商", select_model:"选择模型…",
      compare_title:"费用对比",
      table_model:"模型", table_provider:"提供商", table_tokens:"Token 数", table_cost:"费用",
      table_note_exact:"精确", table_note_est:"估算",
      optimize_title:"优化建议", optimize_subtitle:"在不损失语义的前提下减少 Token 用量",
      tip_whitespace:"删除多余空白字符", tip_repetition:"消除重复短语",
      tip_compress:"使用简写符号", tip_chunk:"拆分为更小的片段"
    },
    features: {
      badge:"为何选择 Tokenia", title:"专为关注成本的开发者构建",
      f1_title:"精确 + 估算", f1_desc:"在可用时使用官方分词器（OpenAI 用 tiktoken，DeepSeek 用 DeepSeek-V3），对其他模型提供清晰标注的估算值。",
      f2_title:"多提供商支持", f2_desc:"在一个界面中比较 OpenAI、Anthropic、Mistral、Cohere、Google 等提供商的费用。",
      f3_title:"文件上传", f3_desc:"分析 TXT、MD、PDF、DOCX 及代码文件，最大 10 MB，不存储任何数据。",
      f4_title:"RAG 与检索", f4_desc:"为 RAG 流水线估算检索成本、分块大小和嵌入 Token 预算。",
      f5_title:"提示词优化器", f5_desc:"获取可操作的建议，在保留提示词含义的同时减少 Token 用量。",
      f6_title:"始终私密", f6_desc:"文本仅在内存中处理，不会被记录、存储或与第三方共享。"
    },
    pricing: {
      badge:"简单定价", title:"免费开始，随时扩展", subtitle:"免费版无需信用卡。",
      free_title:"免费版", free_price:"$0", free_period:"/ 永久",
      free_f1:"无限 Token 计数", free_f2:"所有提供商对比", free_f3:"文件上传（TXT、MD、DOCX、PDF）",
      free_f4:"费用估算", free_f5:"提示词优化建议", free_cta:"免费开始",
      pro_badge:"最受欢迎", pro_title:"专业版", pro_price:"$12", pro_period:"/ 月",
      pro_f1:"包含免费版全部功能", pro_f2:"批量处理（最多 100 个文件）", pro_f3:"API 访问",
      pro_f4:"使用历史与报告", pro_f5:"优先支持", pro_cta:"即将推出",
      team_title:"团队版", team_price:"$49", team_period:"/ 月",
      team_f1:"包含专业版全部功能", team_f2:"最多 10 名团队成员", team_f3:"共享工作区",
      team_f4:"管理员控制台", team_f5:"SLA 支持", team_cta:"即将推出",
      coming_soon_note:"升级功能即将推出——目前所有人免费使用。"
    },
    testimonials: { badge:"开发者反馈", title:"为关注 AI 成本的开发者而生" },
    cta: { title:"免费开始计算 Token", subtitle:"无需注册账户，粘贴文本即可获得结果。", btn:"免费试用 Tokenia" },
    footer: {
      tagline:"面向 LLM 开发者的 Token 智能平台。",
      product:"产品", analyzer:"分析器", pricing:"定价", docs:"文档",
      company:"公司", privacy:"隐私政策", terms:"使用条款", contact:"联系我们", legal:"法律",
      copyright:"© 2025 Tokenia 版权所有。",
      disclaimer:"标注“估算”的 Token 数为近似值，精确值使用官方分词器计算。"
    },
    chat: {
      bubble_title:"询问 Tokenia", header:"Tokenia 帮助",
      welcome:"你好！我是 Tokenia 的助手。可以问我关于 Token 计数、费用或如何入门的任何问题。",
      input_placeholder:"输入你的问题…", btn_send:"发送", btn_close:"关闭",
      quick_what:"什么是 Tokenia？", quick_accuracy:"精确度如何？", quick_start:"如何开始？", quick_cost:"是否免费？",
      fallback:"我暂时没有这个问题的答案。请发邮件至 info@tokenia.live，我们会尽快回复。",
      fallback_form:"或发送消息给我们：", form_name:"您的姓名", form_email:"您的邮箔",
      form_message:"您的问题或留言", form_submit:"发送消息",
      form_success:"消息已发送！我们将在 24 小时内回复。",
      form_error:"发送失败，请直接发邮件至 info@tokenia.live。", char_limit:"剩余字符"
    }
  },

  de: {
    nav: { brand:"Tokenia", analyzer:"Analysator", pricing:"Preise", docs:"Docs", cta:"Kostenlos starten" },
    hero: {
      badge:"Token-Intelligenz-Plattform", title:"Tokens zählen.", title2:"Kosten senken.",
      subtitle:"Text einfügen oder Datei hochladen — erhalte sofort Token-Anzahl und Kostenschätzung für alle großen LLM-Anbieter.",
      cta_primary:"Jetzt starten", cta_secondary:"Preise ansehen"
    },
    stats: { models:"Unterstützte Modelle", accuracy:"Genauigkeit", cost_savings:"Durchschn. Ersparnis", users:"Aktive Nutzer" },
    analyzer: {
      title:"Token-Analysator", subtitle:"Sofortige Token-Anzahl & Kostenschätzung",
      tab_text:"Text einfügen", tab_file:"Datei hochladen",
      placeholder:"Prompt, Dokument oder beliebigen Text hier einfügen…",
      btn_analyze:"Tokens analysieren", btn_clear:"Löschen",
      upload_title:"Datei hier ablegen oder klicken zum Durchsuchen",
      upload_hint:"Unterstützt TXT, MD, PDF, DOCX, Code-Dateien · Max. 10 MB",
      btn_upload:"Datei suchen",
      result_tokens:"Tokens", result_words:"Wörter", result_chars:"Zeichen", result_cost:"Gesch. Kosten",
      result_model:"Modell", result_provider:"Anbieter", select_model:"Modell auswählen…",
      compare_title:"Kostenvergleich",
      table_model:"Modell", table_provider:"Anbieter", table_tokens:"Tokens", table_cost:"Kosten",
      table_note_exact:"Exakt", table_note_est:"Gesch.",
      optimize_title:"Optimierungstipps", optimize_subtitle:"Token-Nutzung reduzieren ohne Bedeutungsverlust",
      tip_whitespace:"Überfüssige Leerzeichen entfernen", tip_repetition:"Wiederholte Phrasen eliminieren",
      tip_compress:"Kurzschreibweise verwenden", tip_chunk:"In kleinere Abschnitte aufteilen"
    },
    features: {
      badge:"Warum Tokenia", title:"Entwickelt für Entwickler, die Kosten im Blick haben",
      f1_title:"Exakt + Geschätzt", f1_desc:"Offizielle Tokenizer wo verfügbar (tiktoken für OpenAI, DeepSeek-V3 für DeepSeek). Klar gekennzeichnete Schätzungen für alle anderen.",
      f2_title:"Multi-Anbieter", f2_desc:"Kosten von OpenAI, Anthropic, Mistral, Cohere, Google und mehr in einer Ansicht vergleichen.",
      f3_title:"Datei-Upload", f3_desc:"TXT, MD, PDF, DOCX und Code-Dateien analysieren. Bis zu 10 MB. Keine Datenspeicherung.",
      f4_title:"RAG & Retrieval", f4_desc:"Retrieval-Kosten, Chunk-Größen und Embedding-Token-Budgets für RAG-Pipelines schätzen.",
      f5_title:"Prompt-Optimierer", f5_desc:"Erhalte umsetzbare Tipps zur Token-Reduzierung bei gleichzeitiger Beibehaltung der Bedeutung.",
      f6_title:"Stets privat", f6_desc:"Text wird nur im Arbeitsspeicher verarbeitet. Nichts wird protokolliert, gespeichert oder weitergegeben."
    },
    pricing: {
      badge:"Einfache Preise", title:"Kostenlos starten, bei Bedarf skalieren", subtitle:"Für den kostenlosen Tarif ist keine Kreditkarte erforderlich.",
      free_title:"Kostenlos", free_price:"$0", free_period:"/ für immer",
      free_f1:"Unbegrenzte Token-Zählung", free_f2:"Alle Anbieter-Vergleiche", free_f3:"Datei-Upload (TXT, MD, DOCX, PDF)",
      free_f4:"Kostenschätzungen", free_f5:"Prompt-Optimierer-Tipps", free_cta:"Kostenlos starten",
      pro_badge:"Beliebteste", pro_title:"Pro", pro_price:"$12", pro_period:"/ Monat",
      pro_f1:"Alles aus Kostenlos", pro_f2:"Stapelverarbeitung (bis 100 Dateien)", pro_f3:"API-Zugang",
      pro_f4:"Nutzungsverlauf & Berichte", pro_f5:"Prioritäts-Support", pro_cta:"Demnächst verfügbar",
      team_title:"Team", team_price:"$49", team_period:"/ Monat",
      team_f1:"Alles aus Pro", team_f2:"Bis zu 10 Teammitglieder", team_f3:"Geteilte Arbeitsbereiche",
      team_f4:"Admin-Dashboard", team_f5:"SLA-Support", team_cta:"Demnächst verfügbar",
      coming_soon_note:"Upgrades kommen bald — derzeit für alle kostenlos."
    },
    testimonials: { badge:"Was Devs sagen", title:"Für Entwickler, die KI-Kosten im Griff haben wollen" },
    cta: { title:"Kostenlos mit Token-Zählung beginnen", subtitle:"Kein Konto erforderlich. Text einfügen und sofort Ergebnisse erhalten.", btn:"Tokenia kostenlos testen" },
    footer: {
      tagline:"Die Token-Intelligenz-Plattform für LLM-Entwickler.",
      product:"Produkt", analyzer:"Analysator", pricing:"Preise", docs:"Docs",
      company:"Unternehmen", privacy:"Datenschutzrichtlinie", terms:"Nutzungsbedingungen", contact:"Kontakt", legal:"Rechtliches",
      copyright:"© 2025 Tokenia. Alle Rechte vorbehalten.",
      disclaimer:"Mit „Gesch.“ markierte Token-Zahlen sind Näherungswerte. Exakte Zahlen verwenden offizielle Tokenizer."
    },
    chat: {
      bubble_title:"Tokenia fragen", header:"Tokenia Hilfe",
      welcome:"Hallo! Ich bin Tokenias Assistent. Frag mich alles über Token-Zählung, Kosten oder den Einstieg.",
      input_placeholder:"Frage stellen…", btn_send:"Senden", btn_close:"Schließen",
      quick_what:"Was ist Tokenia?", quick_accuracy:"Wie genau?", quick_start:"Wie anfangen?", quick_cost:"Ist es kostenlos?",
      fallback:"Darauf habe ich noch keine Antwort. Schreib uns an info@tokenia.live und wir melden uns bald.",
      fallback_form:"Oder sende uns eine Nachricht:", form_name:"Dein Name", form_email:"Deine E-Mail",
      form_message:"Deine Frage oder Nachricht", form_submit:"Nachricht senden",
      form_success:"Nachricht gesendet! Wir antworten innerhalb von 24 Stunden.",
      form_error:"Konnte nicht senden. Bitte schreib direkt an info@tokenia.live.", char_limit:"Zeichen verbleibend"
    }
  }
};


/* ─────────────────────────────────────────────────────────────
   2. FAQ DATA — keyword-based chatbot, no AI needed
   Each entry: { keywords: string[], answer: fn(lang) }
───────────────────────────────────────────────────────────── */
const FAQ = [
  {
    keywords: ['what','is','tokenia','about','qué','es','que','was','ist','是','什么','tokenia'],
    answer: {
      en: "Tokenia is a free token counter and cost estimator for LLM APIs. Paste text or upload a file to instantly see how many tokens it uses and what it would cost across models like GPT-4, Claude, Gemini, and more.",
      es: "Tokenia es un contador de tokens y estimador de costos gratuito para APIs de LLM. Pega texto o sube un archivo para ver instantáneamente cuántos tokens usa y cuánto costaría en modelos como GPT-4, Claude, Gemini y más.",
      zh: "Tokenia 是一款免费的 LLM API Token 计数器和费用估算工具。粘贴文本或上传文件，即可立即查看 GPT-4、Claude、Gemini 等模型的 Token 用量和估算费用。",
      de: "Tokenia ist ein kostenloser Token-Zähler und Kostenschätzer für LLM-APIs. Text einfügen oder Datei hochladen, um sofort zu sehen, wie viele Tokens es benötigt und was es für Modelle wie GPT-4, Claude, Gemini und mehr kosten würde."
    }
  },
  {
    keywords: ['accurate','accuracy','exact','precise','estimation','estimated','est','tiktoken','official','tokenizer','precisión','exacto','genauigkeit','exakt','准确','精确','官方'],
    answer: {
      en: "For OpenAI models (GPT-3.5, GPT-4, etc.) we use tiktoken — the official tokenizer — so counts are exact. For DeepSeek models we use the official DeepSeek-V3 tokenizer, so counts are exact too. For other models (Claude, Gemini, Llama, Mistral) we use calibrated character-to-token ratios clearly labeled as 'Est.' so you always know the difference.",
      es: "Para modelos de OpenAI (GPT-3.5, GPT-4, etc.) usamos tiktoken — el tokenizador oficial — por lo que los conteos son exactos. Para modelos DeepSeek usamos el tokenizador oficial DeepSeek-V3, también exacto. Para otros modelos (Claude, Gemini, Llama, Mistral) usamos ratios carácter-token calibrados, claramente etiquetados como 'Est.'.",
      zh: "对于 OpenAI 模型（GPT-3.5、GPT-4 等），我们使用官方分词器 tiktoken，因此计数是精确的。对于 DeepSeek 模型，我们使用官方 DeepSeek-V3 分词器，计数同样精确。对于其他模型（Claude、Gemini、Llama、Mistral），我们使用校准的字符与 Token 比例进行估算，并清晰标注为"估算"。",
      de: "Für OpenAI-Modelle (GPT-3.5, GPT-4 usw.) verwenden wir tiktoken — den offiziellen Tokenizer — daher sind die Zählungen exakt. Für DeepSeek-Modelle verwenden wir den offiziellen DeepSeek-V3-Tokenizer, ebenfalls exakt. Für andere Modelle (Claude, Gemini, Llama, Mistral) verwenden wir kalibrierte Zeichen-zu-Token-Verhältnisse, klar mit 'Gesch.' gekennzeichnet."
    }
  },
  {
    keywords: ['how','start','use','begin','try','get started','getting started','cómo','empezar','comenzar','wie','anfangen','starten','如何','开始','使用'],
    answer: {
      en: "Getting started is easy — no account needed! Just paste your text into the box on the home page and click 'Analyze Tokens'. You'll instantly see the token count, word count, and cost estimate for all major models. You can also upload TXT, MD, PDF, DOCX, or code files.",
      es: "Comenzar es muy fácil, ¡sin necesidad de cuenta! Solo pega tu texto en el cuadro de la página principal y haz clic en 'Analizar Tokens'. Verás al instante el conteo de tokens, palabras y estimación de costos para todos los principales modelos. También puedes subir archivos TXT, MD, PDF, DOCX o de código.",
      zh: "入门非常简单——无需账户！只需将文本粘贴到主页的输入框中，点击"分析 Token"即可。您将立即看到所有主要模型的 Token 数量、词数和费用估算。您还可以上传 TXT、MD、PDF、DOCX 或代码文件。",
      de: "Der Einstieg ist einfach — kein Konto erforderlich! Text einfach in das Feld auf der Startseite einfügen und auf 'Tokens analysieren' klicken. Sofort erscheinen Token-Anzahl, Wortzahl und Kostenschätzung für alle großen Modelle. Auch TXT, MD, PDF, DOCX oder Code-Dateien können hochgeladen werden."
    }
  },
  {
    keywords: ['free','cost','price','pricing','pay','credit card','charge','subscription','plan','gratis','gratuito','precio','kostenlos','preis','免费','费用','价格','付费'],
    answer: {
      en: "Yes! The core Tokenia features are completely free — unlimited token counting, all provider comparisons, file uploads, and cost estimates. No credit card required, no account needed. Pro and Team plans with batch processing and API access are coming soon.",
      es: "¡Sí! Las funciones principales de Tokenia son completamente gratuitas — conteo ilimitado de tokens, comparaciones de todos los proveedores, subida de archivos y estimaciones de costos. Sin tarjeta de crédito, sin cuenta requerida. Los planes Pro y Equipo con procesamiento por lotes y acceso a API llegarán pronto.",
      zh: "是的！Tokenia 的核心功能完全免费——无限 Token 计数、所有提供商对比、文件上传和费用估算。无需信用卡，无需注册账户。批量处理和 API 访问的专业版和团队版即将推出。",
      de: "Ja! Die Kernfunktionen von Tokenia sind völlig kostenlos — unbegrenzte Token-Zählung, alle Anbieter-Vergleiche, Datei-Uploads und Kostenschätzungen. Keine Kreditkarte, kein Konto erforderlich. Pro- und Team-Pläne mit Stapelverarbeitung und API-Zugang kommen bald."
    }
  },
  {
    keywords: ['file','upload','document','pdf','docx','word','txt','markdown','md','code','archivo','subir','documento','datei','hochladen','文件','上传','文档'],
    answer: {
      en: "You can upload TXT, Markdown (.md), PDF, Word documents (.docx), and most code files (Python, JavaScript, etc.) up to 10 MB. The file content is extracted and analyzed — nothing is stored on our servers after analysis.",
      es: "Puedes subir archivos TXT, Markdown (.md), PDF, documentos Word (.docx) y la mayoría de archivos de código (Python, JavaScript, etc.) hasta 10 MB. El contenido del archivo se extrae y analiza — nada se almacena en nuestros servidores después del análisis.",
      zh: "您可以上传 TXT、Markdown（.md）、PDF、Word 文档（.docx）和大多数代码文件（Python、JavaScript 等），最大 10 MB。文件内容会被提取和分析——分析完成后不会在服务器上存储任何数据。",
      de: "TXT-, Markdown (.md)-, PDF-, Word-Dokumente (.docx) und die meisten Code-Dateien (Python, JavaScript usw.) bis zu 10 MB können hochgeladen werden. Der Dateiinhalt wird extrahiert und analysiert — nach der Analyse wird nichts auf unseren Servern gespeichert."
    }
  },
  {
    keywords: ['models','supported','providers','openai','anthropic','claude','gpt','gemini','mistral','cohere','llama','modelos','soportados','modelle','unterstützt','模型','支持','提供商'],
    answer: {
      en: "Tokenia supports all major LLM providers: OpenAI (GPT-3.5, GPT-4, GPT-4o), Anthropic (Claude 3 Haiku, Sonnet, Opus), Google (Gemini 1.5), Mistral (7B, 8x7B), Cohere (Command R), and more. New models are added as they launch.",
      es: "Tokenia soporta todos los principales proveedores de LLM: OpenAI (GPT-3.5, GPT-4, GPT-4o), Anthropic (Claude 3 Haiku, Sonnet, Opus), Google (Gemini 1.5), Mistral (7B, 8x7B), Cohere (Command R) y más. Los nuevos modelos se añaden cuando se lanzan.",
      zh: "Tokenia 支持所有主要 LLM 提供商：OpenAI（GPT-3.5、GPT-4、GPT-4o）、Anthropic（Claude 3 Haiku、Sonnet、Opus）、Google（Gemini 1.5）、Mistral（7B、8x7B）、Cohere（Command R）等。新模型发布后会及时添加。",
      de: "Tokenia unterstützt alle großen LLM-Anbieter: OpenAI (GPT-3.5, GPT-4, GPT-4o), Anthropic (Claude 3 Haiku, Sonnet, Opus), Google (Gemini 1.5), Mistral (7B, 8x7B), Cohere (Command R) und mehr. Neue Modelle werden bei deren Erscheinen ergänzt."
    }
  },
  {
    keywords: ['privacy','private','data','stored','store','safe','security','share','third party','privacidad','privado','datos','privatsphäre','daten','隐私','数据','安全','存储'],
    answer: {
      en: "Your privacy is our top priority. All text and file content is processed in memory only — we never log, store, or share your input with third parties. Files are discarded immediately after analysis. No account is required, so we collect no personal data.",
      es: "Tu privacidad es nuestra máxima prioridad. Todo el texto y contenido de archivos se procesa solo en memoria — nunca registramos, almacenamos ni compartimos tu entrada con terceros. Los archivos se descartan inmediatamente después del análisis. No se requiere cuenta, por lo que no recopilamos datos personales.",
      zh: "您的隐私是我们的首要任务。所有文本和文件内容仅在内存中处理——我们绝不会记录、存储或与第三方共享您的输入。文件在分析后立即销毁。无需账户，因此我们不收集任何个人数据。",
      de: "Deine Privatsphäre hat höchste Priorität. Alle Texte und Dateiinhalte werden ausschließlich im Arbeitsspeicher verarbeitet — wir protokollieren, speichern oder teilen deine Eingaben nie mit Dritten. Dateien werden sofort nach der Analyse verworfen. Kein Konto erforderlich, daher werden keine persönlichen Daten gesammelt."
    }
  },
  {
    keywords: ['rag','retrieval','embedding','chunk','vector','context window','retrieval augmented','pipeline','rag'],
    answer: {
      en: "For RAG pipelines, Tokenia helps you estimate the token cost of your retrieval chunks, context assembly, and embedding operations. Use the analyzer to measure your chunk sizes and figure out how many chunks fit within your model's context window to optimize retrieval costs.",
      es: "Para pipelines RAG, Tokenia te ayuda a estimar el costo en tokens de tus chunks de recuperación, ensamblado de contexto y operaciones de embedding. Usa el analizador para medir el tamaño de tus chunks y calcular cuántos caben en la ventana de contexto de tu modelo.",
      zh: "对于 RAG 流水线，Tokenia 帮助您估算检索块、上下文组装和嵌入操作的 Token 成本。使用分析器测量您的块大小，计算模型上下文窗口中能容纳多少块，从而优化检索成本。",
      de: "Für RAG-Pipelines hilft Tokenia dabei, die Token-Kosten von Retrieval-Chunks, Kontext-Assemblierung und Embedding-Operationen zu schätzen. Mit dem Analysator Chunk-Größen messen und berechnen, wie viele Chunks in das Kontextfenster des Modells passen."
    }
  },
  {
    keywords: ['optimize','optimization','reduce','tips','fewer tokens','prompt','optimizador','optimizar','optimierung','reduzieren','优化','减少','提示词'],
    answer: {
      en: "Tokenia's built-in optimizer gives you actionable tips: remove redundant whitespace, eliminate repeated phrases, use shorthand notation, and split long documents into smaller chunks. Each tip shows the estimated token savings. Find it in the 'Optimization Tips' section after running an analysis.",
      es: "El optimizador integrado de Tokenia te da consejos prácticos: eliminar espacios redundantes, eliminar frases repetidas, usar notación abreviada y dividir documentos largos en fragmentos más pequeños. Cada consejo muestra el ahorro estimado de tokens. Encuéntralo en la sección 'Consejos de Optimización' después de ejecutar un análisis.",
      zh: "Tokenia 的内置优化器为您提供可操作的建议：删除多余空白字符、消除重复短语、使用简写符号，以及将长文档拆分为更小的片段。每条建议都会显示预计节省的 Token 数量。运行分析后，在"优化建议"部分即可找到。",
      de: "Tokenias integrierter Optimierer gibt umsetzbare Tipps: überflüssige Leerzeichen entfernen, wiederholte Phrasen eliminieren, Kurzschreibweise verwenden und lange Dokumente in kleinere Abschnitte aufteilen. Jeder Tipp zeigt die geschätzte Token-Ersparnis. Nach einer Analyse im Abschnitt 'Optimierungstipps' zu finden."
    }
  },
  {
    keywords: ['api','access','integration','endpoint','key','pro','batch','batches','api access','api key','acceso api','api-zugang','api 访问'],
    answer: {
      en: "A public REST API is available at /api/v1/count — free, no key required, up to 100 requests/hour. For higher limits or batch processing, email us at info@tokenia.live.",
      es: "Hay una API REST pública disponible en /api/v1/count — gratuita, sin clave, hasta 100 solicitudes/hora. Para límites más altos o procesamiento en lotes, escríbenos a info@tokenia.live.",
      zh: "公共 REST API 可通过 /api/v1/count 访问——免费、无需密钥，每小时最多 100 次请求。如需更高限额或批量处理，请发邮件至 info@tokenia.live。",
      de: "Eine öffentliche REST-API ist unter /api/v1/count verfügbar — kostenlos, kein Key erforderlich, bis zu 100 Anfragen/Stunde. Für höhere Limits oder Stapelverarbeitung: info@tokenia.live."
    }
  },
  {
    keywords: ['contact','support','help','email','reach','question','problema','contacto','ayuda','kontakt','hilfe','联系','支持','帮助','邮件'],
    answer: {
      en: "You can reach us at info@tokenia.live — we typically respond within 24 hours. For bug reports or feature requests, use the contact form below.",
      es: "Puedes contactarnos en info@tokenia.live — normalmente respondemos en 24 horas. Para reportes de errores o solicitudes de funciones, usa el formulario de contacto a continuación.",
      zh: "您可以通过 info@tokenia.live 联系我们——我们通常在 24 小时内回复。如需报告错误或提交功能请求，请使用下面的联系表单。",
      de: "Erreichbar unter info@tokenia.live — Antwort typischerweise innerhalb von 24 Stunden. Für Fehlermeldungen oder Feature-Anfragen das untenstehende Kontaktformular nutzen."
    }
  },
  {
    keywords: ['image','picture','photo','vision','imagen','bild','图片','图像','图像计费','vision cost'],
    answer: {
      en: "For vision/image inputs, token cost depends on the image resolution and size. Tokenia shows the estimated cost range based on official provider formulas (e.g. OpenAI charges based on tiles, Claude charges based on dimensions). Note that image token counts are always estimates — providers may vary.",
      es: "Para entradas de visión/imagen, el costo en tokens depende de la resolución y el tamaño de la imagen. Tokenia muestra el rango de costo estimado basado en las fórmulas oficiales de los proveedores. Los conteos de tokens de imágenes son siempre estimaciones.",
      zh: "对于视觉/图像输入，Token 成本取决于图像分辨率和大小。Tokenia 根据官方提供商公式显示估算费用范围（例如，OpenAI 按图块计费，Claude 按尺寸计费）。请注意，图像 Token 计数始终是估算值。",
      de: "Bei Vision-/Bildeingaben hängen die Token-Kosten von Bildauflösung und -größe ab. Tokenia zeigt den geschätzten Kostenbereich basierend auf offiziellen Anbieterformeln. Token-Zählungen für Bilder sind immer Schätzwerte."
    }
  }
];


/* ─────────────────────────────────────────────────────────────
   3. LANGUAGE ENGINE
───────────────────────────────────────────────────────────── */
const SUPPORTED_LANGS = ['en','es','pt','zh','de'];
const DEFAULT_LANG    = 'en';
let   _currentLang    = DEFAULT_LANG;

/** Resolve dot-notation key from nested object */
function _get(obj, key) {
  return key.split('.').reduce((o,k) => (o && o[k] !== undefined ? o[k] : null), obj);
}

/** Translate a key in the current language, falling back to English */
function t(key) {
  const locale = TRANSLATIONS[_currentLang] || TRANSLATIONS[DEFAULT_LANG];
  const fb     = TRANSLATIONS[DEFAULT_LANG];
  return _get(locale, key) ?? _get(fb, key) ?? key;
}

/** Detect preferred language from sessionStorage → navigator.language → default */
function detectLang() {
  const stored = sessionStorage.getItem('tokenia_lang');
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  const nav = (navigator.language || navigator.userLanguage || '').split('-')[0].toLowerCase();
  return SUPPORTED_LANGS.includes(nav) ? nav : DEFAULT_LANG;
}

/** Apply all data-i18n translations to the DOM */
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key   = el.getAttribute('data-i18n');
    const attr  = el.getAttribute('data-i18n-attr'); // optional: 'placeholder','title',etc
    const value = t(key);
    if (!value || value === key) return;
    if (attr) {
      el.setAttribute(attr, value);
    } else {
      el.textContent = value;
    }
  });
  // Update <html lang> attribute
  document.documentElement.lang = _currentLang;
}

/** Switch to a new language and re-render */
function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  _currentLang = lang;
  sessionStorage.setItem('tokenia_lang', lang);
  applyTranslations();
  _updateLangSelector();
  // Refresh chatbot welcome + quick buttons if widget is open
  _refreshChatbot();
}

/* ─────────────────────────────────────────────────────────────
   4. LANGUAGE SELECTOR WIDGET
───────────────────────────────────────────────────────────── */
const LANG_LABELS = { en:'EN', es:'ES', pt:'PT', zh:'中文', de:'DE' };
const LANG_FLAGS  = { en:'🇺🇸', es:'🇪🇸', pt:'🇧🇷', zh:'🇨🇳', de:'🇩🇪' };

function _buildLangSelector() {
  const host = document.getElementById('lang-selector');
  if (!host) return;

  host.className = 'lang-selector';
  host.innerHTML = `
    <button class="lang-btn" aria-haspopup="listbox" aria-expanded="false" id="lang-btn">
      <span id="lang-flag">${LANG_FLAGS[_currentLang]}</span>
      <span id="lang-label">${LANG_LABELS[_currentLang]}</span>
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
    <div class="lang-dropdown" id="lang-dropdown" role="listbox">
      ${SUPPORTED_LANGS.map(l => `
        <button class="lang-option${l===_currentLang?' active':''}" role="option"
          data-lang="${l}" aria-selected="${l===_currentLang}">
          <span>${LANG_FLAGS[l]}</span> ${LANG_LABELS[l]}
        </button>`).join('')}
    </div>`;

  const btn      = host.querySelector('#lang-btn');
  const dropdown = host.querySelector('#lang-dropdown');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    // Toggle 'open' on the dropdown itself — matches CSS .lang-dropdown.open
    const open = dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  host.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('click', () => {
      setLanguage(opt.dataset.lang);
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
}

function _updateLangSelector() {
  const flag  = document.getElementById('lang-flag');
  const label = document.getElementById('lang-label');
  const btn   = document.getElementById('lang-btn');
  if (flag)  flag.textContent  = LANG_FLAGS[_currentLang];
  if (label) label.textContent = LANG_LABELS[_currentLang];
  if (btn)   btn.setAttribute('aria-label', `Language: ${LANG_LABELS[_currentLang]}`);

  document.querySelectorAll('.lang-option').forEach(opt => {
    const active = opt.dataset.lang === _currentLang;
    opt.classList.toggle('active', active);
    opt.setAttribute('aria-selected', active);
  });
}

/* ─────────────────────────────────────────────────────────────
   5. FAQ CHATBOT
───────────────────────────────────────────────────────────── */
const MAX_CHARS   = 500;
let   _chatOpen   = false;
let   _showingForm = false;

/** Score an FAQ entry against user input (word token matching) */
function _scoreFAQ(entry, input) {
  const tokens = input.toLowerCase()
    .replace(/[^\w\s]/g,' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  let score = 0;
  tokens.forEach(tok => {
    entry.keywords.forEach(kw => {
      if (kw === tok) score += 2;
      else if (kw.includes(tok) || tok.includes(kw)) score += 1;
    });
  });
  return score;
}

/** Find the best FAQ match; returns null if score < threshold */
function _findFAQ(input) {
  let best = null, bestScore = 0;
  FAQ.forEach(entry => {
    const s = _scoreFAQ(entry, input);
    if (s > bestScore) { bestScore = s; best = entry; }
  });
  return bestScore >= 2 ? best : null;
}

/** Append a message bubble to the chat window */
function _appendMsg(html, role /* 'bot' | 'user' */) {
  const messages = document.getElementById('chat-messages');
  if (!messages) return;
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = html;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

/** Render the contact form inside chat */
function _showContactForm() {
  _showingForm = true;
  const messages = document.getElementById('chat-messages');
  if (!messages) return;

  const form = document.createElement('div');
  form.className = 'chat-contact-form';
  form.id = 'chat-form';
  form.innerHTML = `
    <p class="form-label">${t('chat.fallback_form')}</p>
    <input type="text"  class="form-input" id="cf-name"    placeholder="${t('chat.form_name')}" maxlength="80">
    <input type="email" class="form-input" id="cf-email"   placeholder="${t('chat.form_email')}" maxlength="120">
    <textarea           class="form-input form-textarea" id="cf-msg" placeholder="${t('chat.form_message')}" maxlength="500" rows="3"></textarea>
    <button class="btn-primary form-btn" id="cf-submit">${t('chat.form_submit')}</button>`;

  messages.appendChild(form);
  messages.scrollTop = messages.scrollHeight;

  document.getElementById('cf-submit').addEventListener('click', async () => {
    const name    = (document.getElementById('cf-name').value   || '').trim();
    const email   = (document.getElementById('cf-email').value  || '').trim();
    const message = (document.getElementById('cf-msg').value    || '').trim();
    if (!email || !message) return;

    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name, email, message, featureClicked:'chatbot', desiredPlan:'inquiry' })
      });
      form.remove();
      _appendMsg(t('chat.form_success'), 'bot');
    } catch {
      _appendMsg(t('chat.form_error'), 'bot');
    }
    _showingForm = false;
  });
}

/** Handle a user message */
function _handleUserMsg(input) {
  const trimmed = input.trim();
  if (!trimmed) return;
  _appendMsg(trimmed, 'user');

  const match = _findFAQ(trimmed);
  if (match) {
    const answer = match.answer[_currentLang] || match.answer[DEFAULT_LANG];
    setTimeout(() => _appendMsg(answer, 'bot'), 280);
  } else {
    setTimeout(() => {
      _appendMsg(t('chat.fallback'), 'bot');
      setTimeout(() => _showContactForm(), 400);
    }, 280);
  }
}

/** Refresh chatbot UI strings after language change */
function _refreshChatbot() {
  const header   = document.getElementById('chat-header-title');
  const inputEl  = document.getElementById('chat-input');
  const sendBtn  = document.getElementById('chat-send');
  const closeBtn = document.getElementById('chat-close');

  if (header)   header.textContent       = t('chat.header');
  if (inputEl)  inputEl.placeholder      = t('chat.input_placeholder');
  if (sendBtn)  sendBtn.textContent      = t('chat.btn_send');
  if (closeBtn) closeBtn.setAttribute('aria-label', t('chat.btn_close'));

  // Rebuild quick buttons
  const qb = document.getElementById('chat-quick-btns');
  if (qb) {
    qb.innerHTML = ['quick_what','quick_accuracy','quick_start','quick_cost'].map(k =>
      `<button class="chat-quick-btn" data-q="${k}">${t('chat.'+k)}</button>`
    ).join('');
    qb.querySelectorAll('.chat-quick-btn').forEach(b =>
      b.addEventListener('click', () => _handleUserMsg(t('chat.'+b.dataset.q)))
    );
  }
}

/** Build and mount the chat widget */
function _buildChatbot() {
  if (document.getElementById('chat-widget')) return; // already built

  const widget = document.createElement('div');
  widget.id = 'chat-widget';
  widget.innerHTML = `
    <button class="chat-bubble" id="chat-toggle" aria-label="${t('chat.bubble_title')}" title="${t('chat.bubble_title')}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    </button>
    <div class="chat-popup" id="chat-popup" aria-hidden="true">
      <div class="chat-popup-header">
        <span id="chat-header-title">${t('chat.header')}</span>
        <button class="chat-close-btn" id="chat-close" aria-label="${t('chat.btn_close')}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-quick-btns" id="chat-quick-btns"></div>
      <div class="chat-input-row">
        <input type="text" class="chat-input" id="chat-input"
          placeholder="${t('chat.input_placeholder')}"
          maxlength="${MAX_CHARS}" autocomplete="off">
        <button class="chat-send-btn" id="chat-send">${t('chat.btn_send')}</button>
      </div>
      <div class="chat-char-counter" id="chat-char-count"></div>
    </div>`;

  document.body.appendChild(widget);

  // Wire toggle
  document.getElementById('chat-toggle').addEventListener('click', _toggleChat);
  document.getElementById('chat-close').addEventListener('click',  _toggleChat);

  // Wire send
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  sendBtn.addEventListener('click', () => {
    _handleUserMsg(inputEl.value);
    inputEl.value = '';
    _updateCharCount('');
  });
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });
  inputEl.addEventListener('input', () => _updateCharCount(inputEl.value));

  // Wire quick buttons
  _refreshChatbot();
}

function _updateCharCount(val) {
  const el = document.getElementById('chat-char-count');
  if (!el) return;
  const remaining = MAX_CHARS - val.length;
  el.textContent = remaining < 100 ? `${remaining} ${t('chat.char_limit')}` : '';
  el.style.color = remaining < 20 ? 'var(--orange)' : 'var(--muted)';
}

function _toggleChat() {
  _chatOpen = !_chatOpen;
  const popup  = document.getElementById('chat-popup');
  const toggle = document.getElementById('chat-toggle');
  if (!popup) return;

  // 'open' on popup matches CSS .chat-popup.open { display:flex }
  popup.classList.toggle('open', _chatOpen);
  popup.setAttribute('aria-hidden', String(!_chatOpen));
  toggle.classList.toggle('active', _chatOpen);

  // Show welcome message on first open
  if (_chatOpen && document.getElementById('chat-messages').children.length === 0) {
    _appendMsg(t('chat.welcome'), 'bot');
  }
  // Focus input when opening
  if (_chatOpen) setTimeout(() => document.getElementById('chat-input')?.focus(), 150);
}

/* ─────────────────────────────────────────────────────────────
   6. INIT
───────────────────────────────────────────────────────────── */
function initI18n() {
  _currentLang = detectLang();
  applyTranslations();
  _buildLangSelector();
  _buildChatbot();
}

// Auto-init on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initI18n);
} else {
  initI18n();
}

// Expose globally for inline onclick usage if needed
window.ToknI18n = { setLanguage, t, currentLang: () => _currentLang };

