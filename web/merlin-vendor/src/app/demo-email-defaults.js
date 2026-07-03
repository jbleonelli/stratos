// @ts-check
// Read-only client mirror of the in-code default copy from
// api/_lib/demo-templates.ts (the COMMON object). Used by
// /platform/marketing/demo's Email-template editor so the platform admin
// can SEE what every demo email currently says — and edit those strings
// into a saved override.
//
// Storage semantics stay the same as before: a saved override of '' means
// "fall back to the default at send time". The UI just pre-fills the
// editor with the default text so it's visible & editable.
//
// Keep this file in lock-step with api/_lib/demo-templates.ts COMMON.{en,fr}
// for the 6 fields listed in EDITABLE_FIELDS over in demo-email-overrides.js.

export const DEMO_EMAIL_DEFAULTS = {
  en: {
    pitchLine:
      'You have been invited to a hands-on demo of Merlin, the agentic operations co-pilot for facility teams. The credentials below give you access to a working environment so you can try the system at your own pace — no setup, no install.',
    guideBody:
      'A complete walkthrough — login → first building → daily plan — lives in the in-app help drawer and at the printable URL below. It mirrors what onboarding customers use, so anything you try in the demo will track to a real deployment.',
    closing:
      'Reply to this email and someone from Adaptiv will pick it up. We can also set up a guided walkthrough if you prefer to see the loop end-to-end with someone from the team.',
    signOff: 'Adaptiv',
    footerTagline: 'Operations intelligence for the built world.',
    note: 'Passwords are unique to this bundle and were generated for this invite. Treat them like any other credential — they grant full access to the demo environment.',
  },
  fr: {
    pitchLine:
      'Vous êtes invité·e à découvrir Merlin, le copilote agentique pour les équipes de facility management. Les identifiants ci-dessous donnent accès à un environnement de démonstration prêt à l’emploi — aucune installation, aucune configuration.',
    guideBody:
      'Un tutoriel détaillé — de la connexion au premier bâtiment opérationnel — est disponible dans l’aide intégrée et à l’adresse imprimable ci-dessous. Il correspond exactement à ce qui est utilisé par les clients en onboarding.',
    closing:
      'Répondez simplement à cet email — quelqu’un d’Adaptiv prendra le relais. Nous pouvons aussi organiser une présentation guidée si vous préférez parcourir la boucle complète avec un membre de l’équipe.',
    signOff: 'L’équipe Adaptiv',
    footerTagline: 'L’intelligence opérationnelle pour l’immobilier.',
    note: 'Les mots de passe sont uniques à cet envoi et ont été générés pour cette invitation. Traitez-les comme n’importe quel identifiant — ils donnent accès complet à l’environnement de démo.',
  },
};
