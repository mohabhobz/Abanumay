/**
 * شفق المساعد · طبقة لون بتسيح ورا كروت الـAI (٢٣ سبتمبر · طلب مهاب).
 *
 * خمس دواير بألوان الهوية (أخضر غامق ← تيل ← نعناعي ← ليموني) متطمّسة
 * ومدموجة، وشريط فاتح بيمشي فوقهم، والكل بيتلاشى لفوق وعلى الجنبين ·
 * فالشفق قاعد في قاع الكارت والكلام فوقه على أرضية نضيفة.
 *
 * **بيظهر وهو شغّال بس** (مهاب · ٢٣ سبتمبر): `live` = المساعد بيقرا
 * أو بيكتب · الشفق بيطلع من القاع ويتنفّس، ولمّا يخلص بيختفي. من غير
 * `live` مالوش وجود على الشاشة، فالكارت الساكن كارت عادي.
 */
export function Aurora({ live }: { live?: boolean }) {
  return (
    <div className={`aur${live ? ' live' : ''}`} aria-hidden="true">
      <span className="aur-lift">
        <b className="aur-b1" />
        <b className="aur-b2" />
        <b className="aur-b3" />
        <b className="aur-b4" />
        <b className="aur-b5" />
        <b className="aur-b6" />
      </span>
    </div>
  )
}
