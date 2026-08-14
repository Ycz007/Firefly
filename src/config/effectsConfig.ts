import type { EntranceConfig, SakuraConfig } from "../types/effectsConfig";

// 特效配置 - 集中管理所有动画特效

export const sakuraConfig: SakuraConfig = {
	// 是否启用樱花特效
	enable: true,

	// 樱花数量
	sakuraNum: 21,

	// 樱花越界限制次数，-1为无限循环
	limitTimes: -1,

	// 樱花尺寸
	size: {
		// 樱花最小尺寸倍数
		min: 0.5,
		// 樱花最大尺寸倍数
		max: 1.1,
	},

	// 樱花不透明度
	opacity: {
		// 樱花最小不透明度
		min: 0.3,
		// 樱花最大不透明度
		max: 0.9,
	},

	// 樱花移动速度
	speed: {
		// 水平移动
		horizontal: {
			// 水平移动速度最小值
			min: -1.7,
			// 水平移动速度最大值
			max: -1.2,
		},
		// 垂直移动
		vertical: {
			// 垂直移动速度最小值
			min: 1.5,
			// 垂直移动速度最大值
			max: 2.2,
		},
		// 旋转速度
		rotation: 0.03,
		// 消失速度，不应大于最小不透明度
		fadeSpeed: 0.03,
	},

	// 层级，确保樱花在合适的层级显示
	zIndex: 100,
};

// 全屏开场动画配置
export const entranceConfig: EntranceConfig = {
	// 是否启用开场动画
	enable: true,

	// Logo 图片路径（public 目录下，以 "/" 开头）
	logo: "/assets/images/effects/entrance-logo.avif",

	// 幕布停留时长（ms）—— Logo/标题展示到幕布上拉前的停留时间
	duration: 2000,

	// 回放策略：once 每会话一次 / always 每次刷新 / off 关闭
	replay: "once",
};
