import { describe, it, expect } from 'vitest'
import { es } from '@/utils/i18n/dictionaries/es'
import { en } from '@/utils/i18n/dictionaries/en'
import { fr } from '@/utils/i18n/dictionaries/fr'
import { de } from '@/utils/i18n/dictionaries/de'
import { it as itDict } from '@/utils/i18n/dictionaries/it'
import { ja } from '@/utils/i18n/dictionaries/ja'

/**
 * D7 (2026-10-23). La 1.ª edición de Bailando con las Estrellas en Telecinco
 * (2024) la ganó Luis, con María Isabel; Sara llegó a la final con Adrián
 * Lastra. «/sobre-nosotros» decía que «se proclamaron ganadores» los dos, y
 * es la página a la que va quien quiere comprobar lo que dice el anuncio.
 */
const BIO3 = {
  es: es.about.bio3,
  en: en.about.bio3,
  fr: fr.about.bio3,
  de: de.about.bio3,
  it: itDict.about.bio3,
  ja: ja.about.bio3,
}

// Lo que tiene que decir cada idioma: que ganó Luis y que Sara fue finalista.
const LUIS_GANO = {
  es: /Luis ganó/, en: /Luis won/, fr: /Luis a remporté/,
  de: /gewann Luis/, it: /Luis ha vinto/, ja: /ルイスが優勝/,
}
const SARA_FINAL = {
  es: /Sara llegó a la final/, en: /Sara reached the final/, fr: /Sara est allée en finale/,
  de: /Sara erreichte das Finale/, it: /Sara è arrivata in finale/, ja: /サラも決勝に進出/,
}

describe('about.bio3 · Bailando con las Estrellas', () => {
  for (const [locale, texto] of Object.entries(BIO3) as [keyof typeof BIO3, string][]) {
    it(`${locale}: dice que ganó Luis y que Sara fue finalista`, () => {
      expect(texto).toMatch(LUIS_GANO[locale])
      expect(texto).toMatch(SARA_FINAL[locale])
    })
  }

  it('es: ya no dice que ganaran los dos', () => {
    expect(es.about.bio3).not.toMatch(/ganadores/)
  })
})
