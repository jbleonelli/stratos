// Portuguese UI translations — merged into the i18n DICT in i18n.js (fills `.pt`).
// Scoped to the chrome the Merlin Mobile worker surface actually renders via the
// global t(): the sign-in / sign-up / reset / recovery flow + the language
// picker. The in-app worker chrome is the ML dict in MobileApp.jsx (already
// five-language); the rest of the desktop DICT falls back to English (mobile is
// the only surface that exposes ES/PT — see mobile-worker-app.md §7).
// Hand-authored (Brazilian Portuguese). /api/translate also speaks `pt` now, so
// this can be machine-extended later if desktop PT is ever wanted.
export const PT = {
  'common.loading': 'Carregando…',

  'auth.login.title': 'Entrar no Merlin',
  'auth.login.subtitle': 'Insira suas credenciais para continuar.',
  'auth.login.submit': 'Entrar',
  'auth.login.switch': 'Criar uma nova conta',
  'auth.login.forgot_link': 'Esqueceu sua senha?',

  'auth.signup.title': 'Crie sua conta',
  'auth.signup.subtitle': 'Pronto em menos de um minuto. Sem cartão de crédito.',
  'auth.signup.submit': 'Criar conta',
  'auth.signup.have': 'Já tem uma conta?',
  'auth.signup.switch': 'Entrar',
  'auth.signup.terms': 'Ao continuar, você concorda com nossos termos e a política de privacidade.',
  'auth.signup.disabled_title': 'O cadastro está fechado no momento',
  'auth.signup.disabled_body':
    'A Adaptiv desativou a criação de novas contas. Se você está esperando um convite, o administrador do seu tenant deve enviá-lo. Caso contrário, entre abaixo.',
  'auth.signup.disabled_back': 'Voltar para o login',

  'auth.field.name': 'Nome completo',
  'auth.field.email': 'E-mail',
  'auth.field.email_work': 'E-mail corporativo',
  'auth.field.company': 'Empresa',
  'auth.field.company.hint': 'Opcional — ajuda a personalizar a experiência.',
  'auth.field.password': 'Senha',
  'auth.field.password.hint': 'No mínimo 8 caracteres.',
  'auth.field.password.placeholder': 'Escolha algo forte',

  'auth.show': 'Mostrar',
  'auth.hide': 'Ocultar',
  'auth.or': 'OU',

  'auth.pw.tooShort': 'Muito curta',
  'auth.pw.weak': 'Fraca',
  'auth.pw.okay': 'Razoável',
  'auth.pw.good': 'Boa',
  'auth.pw.strong': 'Forte',
  'auth.pw.veryStrong': 'Muito forte',

  'auth.err.name': 'O nome é obrigatório.',
  'auth.err.email': 'Insira um e-mail válido.',
  'auth.err.pwLength': 'A senha deve ter no mínimo 8 caracteres.',
  'auth.err.pwMismatch': 'As senhas não coincidem.',
  'auth.err.exists': 'Já existe uma conta com este e-mail.',
  'auth.err.noAccount': 'Nenhuma conta encontrada para esse e-mail.',
  'auth.err.badPassword': 'Senha incorreta.',
  'auth.err.generic': 'Algo deu errado.',
  'auth.err.emailNotConfirmed': 'Confirme seu e-mail antes de entrar.',

  'auth.badge': 'Merlin · colega de trabalho IA',
  'auth.signout': 'Sair',

  'auth.reset.title': 'Redefina sua senha',
  'auth.reset.subtitle': 'Enviaremos por e-mail um link seguro para criar uma nova senha.',
  'auth.reset.check_inbox': 'Verifique sua caixa de entrada',
  'auth.reset.forgot': 'Esqueceu sua senha?',
  'auth.reset.sent_p':
    'Se existir uma conta para {email}, enviamos um link de redefinição. Clique nele para escolher uma nova senha.',
  'auth.reset.enter_p': 'Insira o e-mail vinculado à sua conta e enviaremos um link.',
  'auth.reset.send_link': 'Enviar link',
  'auth.reset.back_to_signin': 'Voltar para o login',
  'auth.reset.email_sent': 'E-mail enviado para {email}.',
  'auth.reset.use_different_email': 'Usar outro e-mail',

  'auth.recovery.title': 'Defina uma nova senha',
  'auth.recovery.subtitle': 'Você acessou por um link de redefinição. Escolha uma nova senha para continuar.',
  'auth.recovery.updated_h2': 'Senha atualizada',
  'auth.recovery.choose_h2': 'Escolha uma nova senha',
  'auth.recovery.updated_p': 'Sua senha foi atualizada. Entre para continuar.',
  'auth.recovery.choose_p': 'Escolha algo que você lembre. Mínimo de 8 caracteres.',
  'auth.recovery.new_password': 'Nova senha',
  'auth.recovery.confirm_password': 'Confirmar senha',
  'auth.recovery.update_btn': 'Atualizar senha',
  'auth.recovery.updated_short': 'Senha atualizada.',
  'auth.recovery.continue_platform': 'Continuar para a plataforma',
  'auth.recovery.continue_customer': 'Continuar para o app do cliente',

  'settings.lang.en': 'Inglês',
  'settings.lang.fr': 'Francês',
  'settings.lang.de': 'Alemão',
  'settings.lang.es': 'Espanhol',
  'settings.lang.pt': 'Português',
  'settings.lang.hint': 'As alterações são aplicadas imediatamente em todo o app.',
};
