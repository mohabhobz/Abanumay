import { useState } from 'react'
import { EditButton, EditModal, type EditChange, type EditField } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { meOf, readRole } from '@/data/roles'
import { REG_STAGES, citiesOf } from '@/data/mock/registration'
import { BANKS } from '@/data/mock/taxonomy'
import {
  adminEditEntity, canAdminEdit, editBank, replaceEntityDoc, useEntityFlow,
} from '@/data/entities/store'
import { ENTITY_RULES } from '@/data/entities/rules'
import type { EntityDetail, BankAccount } from '@/data/mock/entityDetail'
import type { EntityRow } from '@/types/domain'

/* Client 24 Oct · every data section of the entity's file carries its own «تعديل» · the popup holds
   that section's fields, filled, with the closed lists kept closed · the save writes the file and
   its log (before → after, who, when) and tells the entity. Who may edit is the entity rules'
   «تعديل بيانات الجهة» · the system admin always may. */

export type EntitySection = 'id' | 'dates' | 'contact' | 'people'

const REG_FIELD_OF = (k: string) => REG_STAGES.flatMap((st) => st.fields).find((x) => x.key === k)
const optsOf = (k: string): readonly string[] => REG_FIELD_OF(k)?.options ?? []

const SECTION_TITLE: Record<EntitySection, string> = {
  id: 'تعديل التعريف', dates: 'تعديل سريان الصلاحيات', contact: 'تعديل الاتصال', people: 'تعديل الأشخاص',
}

export function entityFields(e: EntityRow, d: EntityDetail, s: EntitySection): EditField[] {
  const rec = e as unknown as Record<string, unknown>
  const det = d as unknown as Record<string, unknown>
  const cur = (k: string): string => {
    const v = k === 'boardEndsAt' ? d.boardMandateEndsAt : rec[k] ?? det[k]
    return v == null ? '' : String(v)
  }
  const f = (key: string, label: string, kind: EditField['kind'] = 'text', extra: Partial<EditField> = {}): EditField => ({ key, label, kind, value: cur(key), ...extra })
  switch (s) {
    case 'id': return [
      f('name', 'اسم الجهة', 'text', { required: true }),
      f('type', 'تصنيف الجهة', 'select', { options: optsOf('type'), required: true }),
      f('licensor', 'جهة الإشراف الفني', 'select', { options: optsOf('licensor') }),
      f('licenseNo', 'رقم الترخيص', 'digits', { required: true }),
      f('region', 'المنطقة', 'select', { options: optsOf('region') }),
      f('city', 'المحافظة / المدينة', 'select', { dependsOn: { key: 'region', options: citiesOf } }),
      f('foundedAt', 'تاريخ التأسيس', 'date'),
      f('governance', 'درجة تقييم الحوكمة', 'number'),
    ]
    case 'dates': return [
      f('licenseEndsAt', 'نهاية الترخيص', 'date', { hint: 'تاريخ ساري يُعيد الحساب «نشطًا» إن كان المانع انتهاءه' }),
      f('boardEndsAt', 'نهاية تكليف أعضاء المجلس', 'date'),
    ]
    case 'contact': return [
      f('phone', 'الهاتف', 'tel'),
      f('mobile', 'جوال الجهة', 'tel'),
      f('email', 'البريد الإلكتروني', 'email'),
      f('website', 'الموقع الإلكتروني', 'url'),
    ]
    case 'people': return [
      f('directorName', 'اسم المدير التنفيذي'),
      f('directorMobile', 'جوال المدير التنفيذي', 'tel'),
      f('clerkName', 'اسم مدخل البيانات'),
      f('clerkMobile', 'جوال مدخل البيانات', 'tel'),
      f('clerkEmail', 'بريد مدخل البيانات', 'email'),
    ]
  }
}

/** The section's «تعديل» on the entity's file · nothing for whoever may not edit */
export function EntityEdit({ e, d, section }: { e: EntityRow; d: EntityDetail; section: EntitySection }) {
  useEntityFlow()
  const role = readRole()
  const [open, setOpen] = useState(false)
  if (!canAdminEdit(role) || e.archived) return null
  return (
    <>
      <EditButton onClick={() => setOpen(true)} />
      {open && (
        <EditModal
          title={`${SECTION_TITLE[section]} · ${e.name}`}
          fields={entityFields(e, d, section)}
          note="يُطبَّق التعديل فورًا على ملف الجهة دون طلب منها · ويُسجَّل في سجل الجهة وتُبلَّغ به."
          onClose={() => setOpen(false)}
          onSave={(changes: EditChange[], _v, reason) => adminEditEntity(e.id, changes, reason, meOf(role), role)}
        />
      )}
    </>
  )
}

/** An account's «تعديل» · its bank from the closed list, its names, its IBAN (unique among active
    accounts) · its certificate is replaced beside it */
export function BankEdit({ entityId, b }: { entityId: string; b: BankAccount }) {
  const role = readRole()
  const [open, setOpen] = useState(false)
  if (!(canAdminEdit(role) || ENTITY_RULES.bankBy.includes(role))) return null
  const fields: EditField[] = [
    { key: 'bank', label: 'اسم البنك', kind: 'select', options: BANKS, value: b.bank, required: true },
    { key: 'shortName', label: 'الاسم المختصر', value: b.shortName },
    { key: 'accountName', label: 'اسم الحساب البنكي', value: b.accountName, required: true },
    { key: 'iban', label: 'رقم الآيبان', kind: 'text', value: b.iban, required: true, hint: 'SA ثم 22 رقمًا · لا يتكرر في حساب مفعّل لجهة أخرى' },
  ]
  return (
    <>
      <EditButton onClick={() => setOpen(true)} />
      {open && (
        <EditModal title={`تعديل الحساب · ${b.bank}`} fields={fields} onClose={() => setOpen(false)}
          note="يُسجَّل التعديل في سجل الجهة · وطلبات الصرف القادمة تُحوَّل إلى الحساب بعد التعديل."
          onSave={(changes, _v, reason) => editBank(entityId, b.id, changes, reason, meOf(role), role)} />
      )}
    </>
  )
}

/** «استبدال» · a new copy of a file already on the record */
export function ReplaceFile({ label, onFile, has = true }: { label: string; onFile: (name: string) => void; has?: boolean }) {
  const word = has ? 'استبدال' : 'ارفع'
  return <UploadButton label={`${word} ${label}`} text={word} onPick={(f) => onFile(f.name)} />
}

/** A document of the entity's file replaced · whoever may edit the file */
export function EntityDocReplace({ entityId, doc, has = true }: { entityId: string; doc: string; has?: boolean }) {
  const role = readRole()
  if (!canAdminEdit(role)) return null
  return <ReplaceFile label={doc} has={has} onFile={(name) => replaceEntityDoc(entityId, doc, name, '', meOf(role), has)} />
}

/** An account's certificate replaced */
export function BankCertReplace({ entityId, b }: { entityId: string; b: BankAccount }) {
  const role = readRole()
  if (!(canAdminEdit(role) || ENTITY_RULES.bankBy.includes(role))) return null
  return <ReplaceFile label="الشهادة البنكية" onFile={(name) => editBank(entityId, b.id, [{ key: 'certificate', label: 'الشهادة البنكية', from: b.certificate, to: name }], '', meOf(role), role)} />
}
