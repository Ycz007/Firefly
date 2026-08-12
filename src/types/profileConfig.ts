export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
		showName?: boolean;
		/** 如果设置，点击时通过 Fancybox 灯箱弹出该图片（如二维码） */
		qrCode?: string;
		/** 如果设置，点击时复制该文本到剪贴板 */
		copy?: string;
	}[];
};
