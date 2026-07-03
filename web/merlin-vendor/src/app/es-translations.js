// Spanish UI translations — merged into the i18n DICT in i18n.js (fills `.es`).
// Scoped to the chrome the Merlin Mobile worker surface actually renders via the
// global t(): the sign-in / sign-up / reset / recovery flow + the language
// picker. The in-app worker chrome is the ML dict in MobileApp.jsx (already
// five-language); the rest of the desktop DICT falls back to English (mobile is
// the only surface that exposes ES/PT — see mobile-worker-app.md §7).
// Hand-authored (neutral Latin-American register). /api/translate also speaks
// `es` now, so this can be machine-extended later if desktop ES is ever wanted.
export const ES = {
  'common.loading': 'Cargando…',

  'auth.login.title': 'Iniciar sesión en Merlin',
  'auth.login.subtitle': 'Ingresa tus credenciales para continuar.',
  'auth.login.submit': 'Iniciar sesión',
  'auth.login.switch': 'Crear una cuenta nueva',
  'auth.login.forgot_link': '¿Olvidaste tu contraseña?',

  'auth.signup.title': 'Crea tu cuenta',
  'auth.signup.subtitle': 'Listo en menos de un minuto. Sin tarjeta de crédito.',
  'auth.signup.submit': 'Crear cuenta',
  'auth.signup.have': '¿Ya tienes una cuenta?',
  'auth.signup.switch': 'Iniciar sesión',
  'auth.signup.terms': 'Al continuar aceptas nuestros términos y la política de privacidad.',
  'auth.signup.disabled_title': 'El registro está cerrado por ahora',
  'auth.signup.disabled_body':
    'Adaptiv ha desactivado la creación de cuentas nuevas. Si esperas una invitación, tu administrador debería enviártela. De lo contrario, inicia sesión abajo.',
  'auth.signup.disabled_back': 'Volver a iniciar sesión',

  'auth.field.name': 'Nombre completo',
  'auth.field.email': 'Correo electrónico',
  'auth.field.email_work': 'Correo del trabajo',
  'auth.field.company': 'Empresa',
  'auth.field.company.hint': 'Opcional — nos ayuda a personalizar la experiencia.',
  'auth.field.password': 'Contraseña',
  'auth.field.password.hint': 'Al menos 8 caracteres.',
  'auth.field.password.placeholder': 'Elige algo seguro',

  'auth.show': 'Mostrar',
  'auth.hide': 'Ocultar',
  'auth.or': 'O',

  'auth.pw.tooShort': 'Muy corta',
  'auth.pw.weak': 'Débil',
  'auth.pw.okay': 'Aceptable',
  'auth.pw.good': 'Buena',
  'auth.pw.strong': 'Fuerte',
  'auth.pw.veryStrong': 'Muy fuerte',

  'auth.err.name': 'El nombre es obligatorio.',
  'auth.err.email': 'Ingresa un correo válido.',
  'auth.err.pwLength': 'La contraseña debe tener al menos 8 caracteres.',
  'auth.err.pwMismatch': 'Las contraseñas no coinciden.',
  'auth.err.exists': 'Ya existe una cuenta con este correo.',
  'auth.err.noAccount': 'No se encontró ninguna cuenta para ese correo.',
  'auth.err.badPassword': 'Contraseña incorrecta.',
  'auth.err.generic': 'Algo salió mal.',
  'auth.err.emailNotConfirmed': 'Confirma tu correo antes de iniciar sesión.',

  'auth.badge': 'Merlin · co-trabajador IA',
  'auth.signout': 'Cerrar sesión',

  'auth.reset.title': 'Restablece tu contraseña',
  'auth.reset.subtitle': 'Te enviaremos por correo un enlace seguro para crear una nueva contraseña.',
  'auth.reset.check_inbox': 'Revisa tu bandeja de entrada',
  'auth.reset.forgot': '¿Olvidaste tu contraseña?',
  'auth.reset.sent_p':
    'Si existe una cuenta para {email}, te enviamos un enlace de restablecimiento. Haz clic en él para elegir una nueva contraseña.',
  'auth.reset.enter_p': 'Ingresa el correo asociado a tu cuenta y te enviaremos un enlace.',
  'auth.reset.send_link': 'Enviar enlace',
  'auth.reset.back_to_signin': 'Volver a iniciar sesión',
  'auth.reset.email_sent': 'Correo enviado a {email}.',
  'auth.reset.use_different_email': 'Usar otro correo',

  'auth.recovery.title': 'Crea una nueva contraseña',
  'auth.recovery.subtitle':
    'Accediste a través de un enlace de restablecimiento. Elige una nueva contraseña para continuar.',
  'auth.recovery.updated_h2': 'Contraseña actualizada',
  'auth.recovery.choose_h2': 'Elige una nueva contraseña',
  'auth.recovery.updated_p': 'Tu contraseña se actualizó. Inicia sesión para continuar.',
  'auth.recovery.choose_p': 'Elige algo que recuerdes. Mínimo 8 caracteres.',
  'auth.recovery.new_password': 'Nueva contraseña',
  'auth.recovery.confirm_password': 'Confirmar contraseña',
  'auth.recovery.update_btn': 'Actualizar contraseña',
  'auth.recovery.updated_short': 'Contraseña actualizada.',
  'auth.recovery.continue_platform': 'Continuar a la plataforma',
  'auth.recovery.continue_customer': 'Continuar a la app de cliente',

  'settings.lang.en': 'Inglés',
  'settings.lang.fr': 'Francés',
  'settings.lang.de': 'Alemán',
  'settings.lang.es': 'Español',
  'settings.lang.pt': 'Portugués',
  'settings.lang.hint': 'Los cambios se aplican de inmediato en toda la app.',
};
