# Chrome Web Store 上架材料

## 商店信息

名称：闽南语小工具

简短说明：选中网页里的闽南语词语或句子，即时查看读音、释义、异用字和辞典正字。

类别建议：教育

语言：中文

主页：https://github.com/Shimada666/minnan-orthography-extension

支持页面：https://github.com/Shimada666/minnan-orthography-extension/issues

隐私政策：https://github.com/Shimada666/minnan-orthography-extension/blob/main/PRIVACY.md

## 详细说明

闽南语小工具帮助用户在阅读网页时快速理解闽南语正字。

选中网页里的单词或句子后，选区旁会出现“閩南”按钮。悬浮按钮即可查看教育部辞典收录的台罗读音、词性和释义。选择整句话时，扩展会从本地辞典中找出可能需要解释的词目。异用字也可以查询，并会提示辞典正字。

主要功能：

- 选词后即时查询，不需要离开当前页面
- 支持单词和整句查询
- 显示台罗、词性与释义
- 支持异用字及辞典正字提示
- 查询完全在本地完成
- 不上传、不保存选中文字
- 无账号、无广告、无追踪

资料来源为教育部《臺灣台語常用詞辭典》。辞典文字内容依 CC BY-ND 3.0 台湾授权使用。

## Single purpose

帮助用户查询网页中主动选取的闽南语文字，显示其读音、释义和正字信息。

## Host permission justification

扩展需要在 HTTP 和 HTTPS 网页中运行内容脚本，以便在用户主动选中文字后，在选区旁显示查询按钮和结果卡片。扩展只处理用户主动选择的文字，所有查询均使用扩展包内置辞典在本地完成，不会上传或保存网页内容。

## Remote code

No. All executable JavaScript is included in the extension package. The extension does not download or execute remote code.

## 数据披露建议

网站内容：处理，但仅处理用户主动选择的文字，且只在设备本地处理，不收集、不保存、不传输。

需要确认的声明：

- 不出售或转移用户数据
- 不将用户数据用于与单一用途无关的目的
- 不将用户数据用于信用评估或借贷
- 不使用用户数据投放个性化广告
- 不允许人工读取用户数据

## 审核员测试步骤

1. 安装扩展并打开任意普通 HTTP 或 HTTPS 网页。
2. 选中“毋知”或“賰”等闽南语词语。
3. 将鼠标悬浮在选区右上角出现的“閩南”按钮上。
4. 确认卡片显示台罗和释义。
5. 选中“講好的山盟海誓毋知擱賰偌濟”，确认卡片显示多个候选词目。
6. 选中“擱”，确认卡片显示异用字及辞典正字提示。

## 已准备的图片

- 商店图标：`store-assets/icon-128.png`
- 最新版功能截图：`store-assets/screenshot-current-1280x800.png`
- 歌词查词截图：`store-assets/screenshot-lyrics-dense-1280x800.png`
- 整句查词截图：`store-assets/screenshot-sentence-1280x800.png`
- 小型宣传图：`store-assets/promo-small-440x280.png`

## 上传包

运行 `npm run package:extension`，上传生成的 `dist/minnan-orthography-extension-0.1.0.zip`。
