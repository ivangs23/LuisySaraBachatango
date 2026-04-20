import { cookies } from 'next/headers';
import { dictionaries, Locale } from './dictionaries';

const VALID_LOCALES: Locale[] = ['es', 'en', 'fr', 'de', 'it', 'ja'];

export async function getDict() {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined;
  const locale = localeCookie && VALID_LOCALES.includes(localeCookie) ? localeCookie : 'es';
  return dictionaries[locale];
}
