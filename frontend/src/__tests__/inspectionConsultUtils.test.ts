import { describe, it, expect } from 'vitest'
import {
  authorName,
  editAccess,
  findingsLine,
  findingsMeta,
  formatMeasuredAt,
  inspectionFindings,
} from '../components/garage/inspection/inspectionConsultUtils'
import { CatalogTaskIconEnum, InterventionSheetStatusEnum } from '../types/schema.d'

const CONFIG_2_5 = { wear_critical_threshold: 2, wear_alert_threshold: 5 }
const CONFIG_3_6 = { wear_critical_threshold: 3, wear_alert_threshold: 6 }

type Args = Parameters<typeof inspectionFindings>[0]

function sheet(overrides: Partial<Args> = {}): Args {
  return {
    wear_measurements: [],
    oil_ok: true,
    coolant_ok: true,
    washer_ok: true,
    lights_ok: true,
    lights_notes: '',
    damages: [],
    tasks: [],
    ...overrides,
  }
}

const measure = (name: string, level: number, id = 1) => ({
  id,
  catalog_task: id,
  catalog_task_name: name,
  catalog_task_icon: CatalogTaskIconEnum.brake,
  level,
})
const damage = (id: number) => ({ id, sheet: 1, description: 'Rayure', photos: [] })
const task = (id: number) => ({ id, sheet: 1, catalog_task: null, name: 'Phares', description: '', dismissed_at: null, photos: [] })

describe('inspectionFindings', () => {
  it('classe une usure selon la config : critique et à surveiller', () => {
    const f = inspectionFindings(sheet({ wear_measurements: [measure('Disques de frein', 2), measure('Pneus', 5, 2)] }), CONFIG_2_5)
    expect(f.red.map((x) => x.title)).toEqual(['Disques de frein critique'])
    expect(f.orange.map((x) => x.title)).toEqual(['Pneus à surveiller'])
    expect(f.watchCount).toBe(1)
    expect(f.tone).toBe('red')
  })

  it('suit les seuils de la configuration (pas de valeur en dur)', () => {
    const wear = { wear_measurements: [measure('Pneus', 3)] }
    expect(inspectionFindings(sheet(wear), CONFIG_2_5).orange).toHaveLength(1)
    expect(inspectionFindings(sheet(wear), CONFIG_3_6).red).toHaveLength(1)
    const six = { wear_measurements: [measure('Pneus', 6)] }
    expect(inspectionFindings(sheet(six), CONFIG_3_6).orange).toHaveLength(1)
    expect(inspectionFindings(sheet(six), CONFIG_2_5).ras).toBe(true)
  })

  it('compte un niveau en défaut et l’éclairage en défaut comme du rouge, avec leur forme courte', () => {
    const f = inspectionFindings(sheet({ washer_ok: false, lights_ok: false, lights_notes: 'Feu stop gauche' }), CONFIG_2_5)
    expect(f.red.map((x) => x.short)).toEqual(['Niveau lave-glace', 'Éclairage'])
    expect(f.red[1].detail).toBe('Feu stop gauche')
    expect(findingsLine(f)).toBe('Niveau lave-glace · Éclairage')
  })

  it('un niveau non vérifié (null) n’est pas un défaut', () => {
    expect(inspectionFindings(sheet({ oil_ok: null, lights_ok: null }), CONFIG_2_5).ras).toBe(true)
  })

  it('dégâts seuls : orange, nommés au pluriel', () => {
    const f = inspectionFindings(sheet({ damages: [damage(1), damage(2)] }), CONFIG_2_5)
    expect(f.tone).toBe('orange')
    expect(findingsLine(f)).toBe('2 dégâts')
    expect(f.orange[0].title).toBe('2 dégâts signalés')
    expect(inspectionFindings(sheet({ damages: [damage(1)] }), CONFIG_2_5).orange[0].title).toBe('1 dégât signalé')
  })

  it('opérations seules : « Aucun défaut relevé » + « n à prévoir », jamais un défaut', () => {
    const f = inspectionFindings(sheet({ tasks: [task(1), task(2), task(3)] }), CONFIG_2_5)
    expect(f.tone).toBe('teal')
    expect(f.ras).toBe(false)
    expect(findingsLine(f)).toBe('Aucun défaut relevé')
    expect(findingsMeta(f)).toEqual(['3 à prévoir'])
  })

  it('RAS : rien du tout', () => {
    const f = inspectionFindings(sheet(), CONFIG_2_5)
    expect(f.ras).toBe(true)
    expect(findingsLine(f)).toBe('RAS')
    expect(findingsMeta(f)).toEqual([])
  })

  it('une fiche sans mesure ne produit pas de constat d’usure', () => {
    expect(inspectionFindings(sheet({ wear_measurements: [] }), CONFIG_2_5).red).toEqual([])
  })

  it('avec du rouge, la ligne 3 résume le reste : à surveiller, dégâts, à prévoir', () => {
    const f = inspectionFindings(
      sheet({ wear_measurements: [measure('Disques de frein', 1), measure('Pneus', 4, 2)], damages: [damage(1), damage(2)], tasks: [task(1)] }),
      CONFIG_2_5,
    )
    expect(findingsLine(f)).toBe('Disques de frein critique')
    expect(findingsMeta(f)).toEqual(['1 à surveiller', '2 dégâts', '1 à prévoir'])
  })

  it('sans rouge, à surveiller et dégâts sont déjà dans la ligne 2 : la ligne 3 ne les répète pas', () => {
    const f = inspectionFindings(sheet({ wear_measurements: [measure('Pneus', 4)], damages: [damage(1)], tasks: [task(1)] }), CONFIG_2_5)
    expect(findingsLine(f)).toBe('Pneus à surveiller · 1 dégât')
    expect(findingsMeta(f)).toEqual(['1 à prévoir'])
  })
})

describe('authorName', () => {
  it('nom complet, sinon e-mail', () => {
    expect(authorName({ created_by: { id: 1, username: 'k', email: 'k@x.fr', first_name: 'Karim', last_name: 'B.' } })).toBe('Karim B.')
    expect(authorName({ created_by: { id: 1, username: 'k', email: 'k@x.fr' } })).toBe('k@x.fr')
  })
})

describe('editAccess', () => {
  const validated = { status: InterventionSheetStatusEnum.validated, validated_at: '2026-10-10T10:00:00Z', updated_at: '2026-10-11T10:00:00Z' }
  const garagiste = { canManage: true, canEditValidated: false }
  const responsable = { canManage: true, canEditValidated: true }

  it('dans le délai de 3 jours, tout garagiste peut modifier', () => {
    expect(editAccess(validated, 3, garagiste, new Date('2026-10-13T09:59:59Z'))).toBe('allowed')
  })

  it('à la limite exacte, encore autorisé ; une seconde après, verrouillé', () => {
    expect(editAccess(validated, 3, garagiste, new Date('2026-10-13T10:00:00Z'))).toBe('allowed')
    expect(editAccess(validated, 3, garagiste, new Date('2026-10-13T10:00:01Z'))).toBe('locked')
  })

  it('au-delà du délai, la permission de dépassement suffit', () => {
    expect(editAccess(validated, 3, responsable, new Date('2026-12-01T00:00:00Z'))).toBe('allowed')
  })

  it('sans manage_inspection : rien, même avec la permission de dépassement ou dans le délai', () => {
    expect(editAccess(validated, 3, { canManage: false, canEditValidated: false }, new Date('2026-10-11T00:00:00Z'))).toBe('none')
    expect(editAccess(validated, 3, { canManage: false, canEditValidated: true }, new Date('2026-10-11T00:00:00Z'))).toBe('none')
  })

  it('fiche ancienne sans validated_at : le délai part de updated_at', () => {
    const old = { ...validated, validated_at: null }
    expect(editAccess(old, 3, garagiste, new Date('2026-10-14T09:00:00Z'))).toBe('allowed')
    expect(editAccess(old, 3, garagiste, new Date('2026-10-14T11:00:00Z'))).toBe('locked')
  })

  it('délai de configuration inconnu : verrouillé par prudence (l’API tranche)', () => {
    expect(editAccess(validated, undefined, garagiste, new Date('2026-10-11T00:00:00Z'))).toBe('locked')
  })

  it('une fiche non validée n’est pas concernée', () => {
    expect(editAccess({ ...validated, status: InterventionSheetStatusEnum.open }, 3, garagiste)).toBe('none')
  })
})

describe('formatMeasuredAt', () => {
  it('« 3 oct. » : jour sans zéro, mois abrégé avec point', () => {
    expect(formatMeasuredAt('2026-10-03')).toBe('3 oct.')
    expect(formatMeasuredAt('2026-01-15')).toBe('15 janv.')
    expect(formatMeasuredAt('2026-05-02')).toBe('2 mai')
    expect(formatMeasuredAt('2026-03-09')).toBe('9 mars')
  })
})
