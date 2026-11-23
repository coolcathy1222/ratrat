export const SPECIES_IDS = ['cream', 'gray', 'calico', 'scarf', 'gold', 'crown'] as const

export type Species = (typeof SPECIES_IDS)[number]

export const SPECIES_NAME: Record<Species, string> = {
  cream: '当当',
  gray: '阿布',
  calico: 'luppy',
  scarf: '叮叮当',
  gold: '嘟嘟',
  crown: '莫莉',
}

export const SPECIES_PROFILE: Record<Species, { personality: string; bio: string; talent: string }> = {
  cream: {
    talent: '分粮高手 · 15% 概率让路线补给翻倍',
    personality: '热心，藏不住小秘密',
    bio: '当当每次分奶酪，都悄悄给最后回洞的伙伴留一块。大家早就知道藏在哪儿了，因为每次有人走近那只碗，当当就忍不住偷笑。',
  },
  gray: {
    talent: '随身探路镜 · 每关自带一次五步指引',
    personality: '好奇，做事一板一眼',
    bio: '阿布爱画地图，连歪树根都要量一量。地图上有个谁也看不懂的小圈，问了才知道，那是午后晒肚皮最舒服的地方。',
  },
  calico: {
    talent: '采花能手 · 路线上每朵野花多收一份',
    personality: '慢热，很会听心事',
    bio: '刚认识时，luppy只肯挪出半张叶子让你坐。等你说完心事才会发现，整张叶子都到了你这边，luppy正坐在泥巴上。',
  },
  scarf: {
    talent: '热情招募 · 遇到伙伴时入队率为 40%',
    personality: '胆子小，偏要打头阵',
    bio: '每次进黑洞，叮叮当都抢着走最前面，还要一路哼歌。伙伴夸那首进行曲好听，叮叮当小声承认：“我只是在给自己壮胆呀。”',
  },
  gold: {
    talent: '幸运开箱 · 宝箱稀有率增加 10 个百分点',
    personality: '乐天，满脑袋怪点子',
    bio: '嘟嘟拿核桃壳做了条船，下水才发现船只装得下一只脚。嘟嘟想了一会儿，又找来半个壳。现在两只脚都有船啦！',
  },
  crown: {
    talent: '守袋能手 · 盗宝鼬无法偷走本关补给',
    personality: '随和，遇事沉得住气',
    bio: '仓库里少了一颗栗子，大伙儿翻遍了口袋。莫莉让大家安静一会儿，贴着地板听了听：“听，它还在桌子底下滚呢。”',
  },
}

export const RARITY: Record<Species, number> = {
  cream: 0,
  gray: 1,
  calico: 2,
  scarf: 3,
  gold: 4,
  crown: 5,
}

export const SPECIES_COLOR: Record<Species, string> = {
  cream: '#F6DFB6',
  gray: '#C5A47D',
  calico: '#8C8077',
  scarf: '#B17860',
  gold: '#E9B467',
  crown: '#C7A38B',
}
