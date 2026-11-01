import { LoginForm } from '@/modules/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="login-layout">
      <section className="login-showcase">
        <div className="brand">
          <span className="brand-mark">N</span>Nexo Assist
        </div>
        <div className="showcase-story">
          <p>Service desk de TI da Nexo</p>
          <h2>Seu problema de TI, resolvido em uma conversa.</h2>
          <p className="showcase-body">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central
            de ajuda e chama um analista quando precisa.
          </p>
          <div className="preview-chat" aria-label="Exemplo de conversa">
            <div className="preview-user">Meu notebook não conecta na VPN. Erro 809.</div>
            <small>Nexo Assist · consultou seus chamados</small>
            <div className="preview-answer">
              Encontrei um artigo sobre o erro 809 no Windows 10. Quer conferir os passos antes de
              abrir um chamado?
            </div>
            <div className="preview-ticket">
              ● INC-20311 <span>Rede e VPN · Alta</span>
            </div>
          </div>
        </div>
        <div className="showcase-stats">
          <div>
            <strong>08–18</strong>
            <span>horário do service desk</span>
          </div>
          <div>
            <strong>30</strong>
            <span>mensagens por sessão</span>
          </div>
          <div>
            <strong>24/7</strong>
            <span>plantão crítico</span>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-help">
          Problema para entrar? <strong>Ligue no ramal 4000</strong>
        </div>
        <LoginForm
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
          githubEnabled={Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)}
        />
        <div className="login-footer">© 2026 Nexo · Service desk de TI</div>
      </section>
    </div>
  );
}
