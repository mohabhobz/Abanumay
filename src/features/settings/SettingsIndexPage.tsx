import { Link } from 'react-router-dom'
import { Glass, Head, Icon, icons, Num, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { SETTING_MODULES } from '@/data/mock/settings'

/* Settings inventory.

   This page isn't where settings live, it's their index. Each group is
   configured on its own module's page, and this page answers one
   question: "what needs configuring in this system."

   The reason there are two entry points to the same screen, each for a
   different question:

   - A button in the module header — used when something currently
   working hits a missing list: "where do I add this city?"
   - This page — used by a system admin setting things up from scratch.

   Neither creates a second version of the screen — the same path opens
   from both.

   There's also no entry point for it in the nav rail. The rail has seven
   items by design, and this screen is used by roughly one in twenty
   users, so its entry point is in the account menu alongside preferences. */

export default function SettingsIndexPage() {
  const groups = SETTING_MODULES.flatMap((m) => m.groups)
  const master = groups.filter((g) => g.kind === 'master').length
  const rules = groups.length - master

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات النظام')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">إعدادات النظام</h1>
              {/* The number doesn't come directly after the `·` separator — the dot is
                  direction-neutral, so it sticks to the Latin numeral and reads as if
                  it were a zero ("· 7" reads as "70"). A word separates them instead. */}
              <p className="sub mt-1">
                القيم والقواعد التي تُبنى عليها جميع الوحدات ·
                وتضم <Num>{master}</Num> مجموعة بيانات أساسية
                و<Num>{rules}</Num> مجموعة قواعد عمل
              </p>
            </div>
          </header>

          {SETTING_MODULES.map((m) => (
            <Glass key={m.key}>
              {/* Each card opens its own group (the module page on that tab). The header keeps a
                  quiet link to the whole module, instead of a settings button per module that
                  opened the same combined page from every card. */}
              <Head
                title={m.label}
                meta={<Link className="lnk" to={m.to}>كل إعدادات {m.label}</Link>}
              />
              <ul className="cfggrid">
                {m.groups.map((g) => (
                  <li key={g.key}>
                    <Link className="cfgg-a" to={g.to ?? (g.tab ? `${m.to}?tab=${g.tab}` : m.to)}>
                    <span className="cfgg-h">
                      <b>{g.label}</b>
                      <span className="pc-sp" />
                      <Tag tone={g.kind === 'master' ? 'mute' : 'warn'}>
                        {g.kind === 'master' ? 'بيانات أساسية' : 'قاعدة عمل'}
                      </Tag>
                    </span>
                    <span className="sub cfgg-w">{g.where}</span>
                    <span className="cfgg-f">
                      <span className="sub">{g.owner}</span>
                      <span className="pc-sp" />
                      {/* "Value" isn't decoration — a bare number in the corner of a card makes
                          the reader ask "four of what?" */}
                      <span className="sub"><b className="num"><Num>{g.count}</Num></b> قيمة</span>
                      <Icon name={icons.chevron} size="sm" className="cfgg-go" />
                    </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Glass>
          ))}

          {/* These two distinctions are deliberately placed last — the page opens
              onto what the user came here to do, and the rules explain themselves
              after they see it. */}
          <div className="g2">
            {/* Personal preferences aren't here — theme and density live under the
                user's account, and mixing the two is what makes someone go looking
                for "cities" in their preferences. */}
            <Glass>
              <Head title="ما لا تجده هنا" meta={<Tag tone="mute">توضيح</Tag>} />
              <p className="sub">
                المظهر والكثافة واللغة <b>تفضيلات شخصية</b> لا إعدادات نظام ·
                تجدها في{' '}
                <Link className="tlink" to={ROUTES.preferences}>تفضيلات الحساب</Link>.
                أما ما هنا فيغيّر سلوك النظام لجميع المستخدمين.
              </p>
            </Glass>

            {/* The rule that surfaces gaps — written down so whoever comes after us
                knows how to tell something is missing. */}
            <Glass>
              <Head title="كيف يُكتشف الإعداد الناقص" meta={<Tag tone="mute">قاعدة</Tag>} />
              <p className="sub">
                كل قائمة منسدلة في أي نموذج = <b>بيانات أساسية</b> لها مكان هنا ·
                فإن وُجدت قائمة مكتوبة في الكود، فهي مجموعة ناقصة في
                الإعدادات لا اختصار مقصود.
              </p>
            </Glass>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
