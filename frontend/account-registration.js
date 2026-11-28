import { profileValues, passwordError } from './settings-domain.js';

export function registrationCredentials({ name, email, password, confirmation }, origin) {
  const { display_name } = profileValues(name, '');
  const problem = passwordError(password, confirmation);
  if (problem) throw new Error(problem);

  return {
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: new URL('/', origin).href,
      data: { display_name, kamby_registration: true }
    }
  };
}

export const privacyPolicyVersion = '2026-11-28.1';
export const isAvailablePrivacyVersion = version => [privacyPolicyVersion, '2026-11-27.1'].includes(version);

export function registrationEvidence({adult, accepted, marketing}, documents) {
  if (adult !== 'yes') throw new Error('A criação de conta está disponível para maiores de 18 anos.');
  if (accepted !== true) throw new Error('Aceita os Termos de utilização e a Política de privacidade.');
  if (!isAvailablePrivacyVersion(documents?.privacy_version) || !documents.terms_version) {
    throw new Error('Os documentos foram actualizados. Reabre o registo para os consultar.');
  }
  return {
    adult_declared: true,
    legal_accepted: true,
    terms_version: documents.terms_version,
    privacy_version: documents.privacy_version,
    email_marketing: marketing === true
  };
}

export function registrationError(error) {
  switch (error?.code) {
    case 'email_address_not_authorized':
      return 'O envio para este endereço está indisponível. Contacta a equipa Kamby.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Aguarda alguns minutos antes de pedir outro e-mail.';
    case 'hook_forbidden':
    case 'hook_timeout':
      return 'Não foi possível validar o registo. Reabre o formulário e confirma os documentos.';
    case 'signup_disabled':
      return 'A criação de contas está temporariamente indisponível.';
    case 'weak_password':
      return 'Escolhe uma palavra-passe mais forte.';
    default:
      return 'Não foi possível pedir o e-mail de confirmação. Tenta novamente.';
  }
}

export async function loadAccountProfile(platform, user) {
  const profiles = platform.from('kg_profiles');
  const read = () => profiles.select('display_name,location').eq('id', user.id).maybeSingle();
  const result = await read();
  const metadata = user.user_metadata;
  if (result.error || result.data || !user.email_confirmed_at || metadata?.kamby_registration !== true) return result;

  let profile;
  try {
    profile = profileValues(metadata.display_name, '');
  } catch {
    return result;
  }
  // A second tab may have created the profile already. Keep any edits it made.
  const { error } = await profiles.insert({ id: user.id, display_name: profile.display_name });
  if (error && error.code !== '23505') return { data: null, error };
  return read();
}
