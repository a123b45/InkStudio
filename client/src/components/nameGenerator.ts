export type NameGender = 'male' | 'female' | 'any';

export type NameStyle =
  | 'modern'
  | 'ancient'
  | 'xianxia'
  | 'compound'
  | 'westeur'
  | 'anglo'
  | 'japanese'
  | 'fantasy';

export interface NameStyleMeta {
  id: NameStyle;
  label: string;
  description: string;
}

export const NAME_STYLES: NameStyleMeta[] = [
  { id: 'modern', label: '现代汉语', description: '常见现代姓名' },
  { id: 'ancient', label: '古风', description: '古典雅致、适合历史/武侠' },
  { id: 'xianxia', label: '仙侠玄幻', description: '网文常见修仙名' },
  { id: 'compound', label: '复姓', description: '欧阳、司马等复姓' },
  { id: 'westeur', label: '西欧译名', description: '中文译音西式名' },
  { id: 'anglo', label: '英美原名', description: 'English given + surname' },
  { id: 'japanese', label: '日本', description: '日式姓名' },
  { id: 'fantasy', label: '西方奇幻', description: '魔幻/史诗风格' },
];

const SURNAMES =
  '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮下齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴郁胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公';

const COMPOUND_SURNAMES = [
  '欧阳', '司马', '上官', '诸葛', '慕容', '令狐', '端木', '皇甫', '夏侯',
  '尉迟', '长孙', '东方', '西门', '南宫', '公孙', '轩辕', '独孤', '司徒',
  '太史', '申屠', '宇文', '闻人', '濮阳', '淳于', '闾丘', '公羊',
  '赫连', '万俟', '钟离', '拓跋', '段干', '百里', '呼延', '东郭', '南门',
];

const MODERN_MALE = [
  '宇轩', '浩然', '子涵', '博文', '俊杰', '明辉', '志远', '天宇', '梓豪', '睿哲',
  '晨阳', '嘉懿', '逸飞', '泽宇', '铭轩', '皓然', '景行', '承泽', '亦辰', '书航',
];
const MODERN_FEMALE = [
  '雨桐', '欣怡', '诗涵', '梓萱', '思琪', '语嫣', '梦洁', '佳怡', '静怡', '晓雯',
  '若曦', '雅婷', '心怡', '紫涵', '可馨', '雨薇', '思颖', '婉清', '乐瑶', '诗雨',
];
const MODERN_NEUTRAL = [
  '安宁', '思远', '予安', '知秋', '清和', '安然', '乐言', '念初', '知微', '望舒',
];

const ANCIENT_MALE = [
  '子墨', '云舟', '清和', '明远', '逸尘', '亦辰', '书白', '言秋', '怀瑾', '修远',
  '景行', '承宇', '子衿', '长歌', '闻溪', '望舒', '知微', '青崖', '临渊', '归鸿',
];
const ANCIENT_FEMALE = [
  '清歌', '若雪', '语嫣', '梦瑶', '婉清', '静姝', '映雪', '素心', '语棠', '锦书',
  '兰心', '月华', '舒窈', '念慈', '听澜', '栖梧', '落英', '采薇', '凝霜', '佩兰',
];

const XIANXIA_MALE = [
  '云澈', '萧尘', '叶凡', '林动', '苏辰', '陆沉舟', '楚风', '夜寒', '凌霄', '墨白',
  '玄天', '剑心', '无尘', '天行', '破虚', '星河', '青冥', '白羽', '寒江', '惊鸿',
];
const XIANXIA_FEMALE = [
  '清歌', '洛神', '白芷', '月灵', '雪舞', '凤九', '紫萱', '冰璃', '云裳', '琉璃',
  '若仙', '灵儿', '霓裳', '碧落', '青鸾', '素问', '忘机', '听雪', '飞霜', '凝碧',
];

const WESTEUR_MALE = [
  '威廉', '亨利', '查理', '亚历山大', '菲利普', '路易', '维克多', '理查德', '亚瑟', '但丁',
  '安东尼', '雨果', '费迪南', '弗雷德里克', '马库斯', '朱利叶斯', '凯撒', '拿破仑',
];
const WESTEUR_FEMALE = [
  '伊丽莎白', '维多利亚', '玛丽', '安娜', '索菲亚', '夏洛特', '凯瑟琳', '伊莎贝拉',
  '戴安娜', '朱丽叶', '埃莉诺', '奥菲利亚', '瓦伦蒂娜', '塞西莉亚', '格蕾丝',
];
const WESTEUR_LAST = [
  '史密斯', '约翰逊', '威廉姆斯', '布朗', '戴维斯', '威尔逊', '米勒', '泰勒',
  '安德森', '托马斯', '杰克逊', '克拉克', '刘易斯', '罗宾逊', '霍尔', '马丁',
];

const ANGLO_MALE = [
  'James', 'Liam', 'Noah', 'Oliver', 'Ethan', 'Lucas', 'Henry', 'Alexander', 'Daniel', 'Sebastian',
  'Benjamin', 'Samuel', 'Gabriel', 'Theodore', 'Leo', 'Julian', 'Caleb', 'Owen', 'Jack', 'Ryan',
];
const ANGLO_FEMALE = [
  'Emma', 'Olivia', 'Ava', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Evelyn', 'Abigail',
  'Emily', 'Scarlett', 'Grace', 'Chloe', 'Lily', 'Aria', 'Nora', 'Lucy', 'Stella', 'Violet',
];
const ANGLO_LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson',
  'Thomas', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall', 'Young',
];

const JP_SURNAMES = [
  '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '山口', '松本', '井上', '木村', '林', '斎藤', '清水', '山崎',
];
const JP_MALE = [
  '翔', '大翔', '颯太', '蒼', '悠真', '陽翔', '蓮', '湊', '大和', '悠斗',
  '拓海', '健太', '翼', '直樹', '亮太', '翔太', '颯', '駿', '廉', '樹',
];
const JP_FEMALE = [
  '陽葵', '凛', '結愛', '結菜', '芽依', '葵', '紬', '澪', '陽菜', '莉子',
  '美咲', '未来', '愛菜', '美優', '琴音', '杏', '優衣', '花音', '楓', '遥',
];

const FANTASY_MALE = [
  'Aerion', 'Thorin', 'Kael', 'Darian', 'Rowan', 'Ashwin', 'Lucian', 'Caspian', 'Eldric', 'Theron',
  '索林', '阿拉贡', '莱戈拉斯', '提姆', '凯尔', '达里安', '艾里昂', '卡西安',
];
const FANTASY_FEMALE = [
  'Aeliana', 'Lyra', 'Seraphina', 'Elara', 'Isolde', 'Mira', 'Nyx', 'Freya', 'Celeste', 'Arwen',
  '艾拉', '塞拉菲娜', '伊索尔德', '莉雅', '芙蕾雅', '亚玟', '盖拉德丽尔',
];
const FANTASY_LAST = [
  'Stormwind', 'Nightshade', 'Silverleaf', 'Ironforge', 'Starfall', 'Ravencrest', 'Moonwhisper',
  '黑森林', '星落', '银叶', '铁炉', '霜寒', '永夜', '风语',
];

export interface GeneratedName {
  full: string;
  tag: string;
}

export interface GenerateOptions {
  gender: NameGender;
  style: NameStyle;
  count: number;
  surname?: string;
  lockSurname?: boolean;
  lockedSurname?: string;
  exclude?: Set<string>;
}

export interface GenerateResult {
  names: GeneratedName[];
  lockedSurname?: string;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSurnameChar(): string {
  return SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
}

function poolByGender(male: string[], female: string[], neutral: string[], gender: NameGender): string[] {
  if (gender === 'male') return male;
  if (gender === 'female') return female;
  return [...male, ...female, ...neutral];
}

function tagFor(style: NameStyle, gender: NameGender): string {
  const styleLabel = NAME_STYLES.find(s => s.id === style)?.label ?? '';
  const g = gender === 'male' ? '男' : gender === 'female' ? '女' : '';
  return g ? `${styleLabel}·${g}` : styleLabel;
}

function buildChineseGiven(style: NameStyle, gender: NameGender): string {
  if (style === 'ancient') return pick(poolByGender(ANCIENT_MALE, ANCIENT_FEMALE, MODERN_NEUTRAL, gender));
  if (style === 'xianxia') return pick(poolByGender(XIANXIA_MALE, XIANXIA_FEMALE, [], gender));
  return pick(poolByGender(MODERN_MALE, MODERN_FEMALE, MODERN_NEUTRAL, gender));
}

function extractSurnameFromName(full: string, style: NameStyle): string {
  if (style === 'westeur') return full.split('·')[0] ?? full;
  if (style === 'anglo' || (style === 'fantasy' && full.includes(' '))) {
    const parts = full.split(' ');
    return parts[parts.length - 1] ?? full;
  }
  if (style === 'japanese') return full.split(' ')[0] ?? full;
  if (style === 'compound') return full.slice(0, 2);
  return full[0] ?? full;
}

function cnFantasyPool(male: string[], female: string[]) {
  return {
    male: male.filter(n => /[\u4e00-\u9fff]/.test(n)),
    female: female.filter(n => /[\u4e00-\u9fff]/.test(n)),
  };
}

function enFantasyPool(male: string[], female: string[]) {
  return {
    male: male.filter(n => !/[\u4e00-\u9fff]/.test(n)),
    female: female.filter(n => !/[\u4e00-\u9fff]/.test(n)),
  };
}

function generateOne(opts: GenerateOptions, fixedSurname?: string): GeneratedName {
  const { gender, style } = opts;
  const custom = (opts.surname ?? '').trim();
  const surname = fixedSurname ?? custom;
  const tag = tagFor(style, gender);

  if (style === 'modern' || style === 'ancient' || style === 'xianxia') {
    const last = surname || pickSurnameChar();
    return { full: last + buildChineseGiven(style, gender), tag };
  }

  if (style === 'compound') {
    const last = surname || pick(COMPOUND_SURNAMES);
    const givenStyle = Math.random() > 0.5 ? 'ancient' : 'xianxia';
    return { full: last + buildChineseGiven(givenStyle as NameStyle, gender), tag };
  }

  if (style === 'westeur') {
    const first = pick(poolByGender(WESTEUR_MALE, WESTEUR_FEMALE, [...WESTEUR_MALE, ...WESTEUR_FEMALE], gender));
    const last = surname || pick(WESTEUR_LAST);
    return { full: `${last}·${first}`, tag };
  }

  if (style === 'anglo') {
    const first = pick(poolByGender(ANGLO_MALE, ANGLO_FEMALE, [...ANGLO_MALE, ...ANGLO_FEMALE], gender));
    const last = surname || pick(ANGLO_LAST);
    return { full: `${first} ${last}`, tag };
  }

  if (style === 'japanese') {
    const last = surname || pick(JP_SURNAMES);
    const given = pick(poolByGender(JP_MALE, JP_FEMALE, [...JP_MALE, ...JP_FEMALE], gender));
    return { full: `${last} ${given}`, tag };
  }

  const cn = cnFantasyPool(FANTASY_MALE, FANTASY_FEMALE);
  const en = enFantasyPool(FANTASY_MALE, FANTASY_FEMALE);
  const cnLast = FANTASY_LAST.filter(n => /[\u4e00-\u9fff]/.test(n));
  const enLast = FANTASY_LAST.filter(n => !/[\u4e00-\u9fff]/.test(n));

  if (Math.random() > 0.5 && cn.male.length > 0) {
    const first = pick(poolByGender(cn.male, cn.female, [], gender));
    const last = surname || pick(cnLast.length ? cnLast : ['星落']);
    return { full: last + first, tag };
  }
  const first = pick(poolByGender(en.male, en.female, [], gender));
  const last = surname || pick(enLast.length ? enLast : ['Starfall']);
  return { full: `${first} ${last}`, tag };
}

export function generateNames(opts: GenerateOptions): GenerateResult {
  const { count, lockSurname, surname, exclude = new Set() } = opts;
  const results: GeneratedName[] = [];
  const seen = new Set<string>(exclude);

  let locked = opts.lockedSurname;
  const custom = (surname ?? '').trim();
  if (lockSurname && custom) locked = custom;

  let attempts = 0;
  const maxAttempts = count * 40;

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    const item = generateOne(opts, lockSurname ? locked : undefined);

    if (lockSurname && !locked && !custom) {
      locked = extractSurnameFromName(item.full, opts.style);
      continue;
    }

    if (seen.has(item.full)) continue;
    seen.add(item.full);
    results.push(item);
  }

  return { names: results, lockedSurname: locked };
}

export function generateSingleName(opts: Omit<GenerateOptions, 'count'>, exclude: Set<string>): GeneratedName | null {
  const { names } = generateNames({ ...opts, count: 1, exclude });
  return names[0] ?? null;
}

export function surnamePlaceholder(style: NameStyle): string {
  switch (style) {
    case 'westeur': return '姓氏（可选，如 史密斯）';
    case 'anglo': return '姓氏（可选，如 Smith）';
    case 'japanese': return '姓氏（可选，如 佐藤）';
    case 'compound': return '复姓（可选，如 欧阳）';
    case 'fantasy': return '姓氏（可选）';
    default: return '姓氏（可选，如 李）';
  }
}
