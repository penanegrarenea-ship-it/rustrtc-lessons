# 0019视频回声：脱敏验证摘要

验证日期2026-11-26，所有时刻为JST。上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。本轮未改库、依赖、示例。此文件是实际验证材料的字段摘录，不是用户本机结果或性能报告。

## 环境和路径

- 云端Linux 6.12.113+ x86_64，rustc/cargo 1.100.0，Chrome 157.0.8103.50。
- 仓库根目录 `cargo +1.100.0 build --example echo_server` 退出0。保留原库3条弃用警告。02:06:32.044978 JST服务开始监听127.0.0.1:3000。
- 原页面模式Data Channel + Local Cam Echo，值echo，点击Start Connection。请求体包含sdp、type、mode。页面采集video:true、audio:false。
- Chrome使用use-fake-device-for-media-stream、use-fake-ui-for-media-stream及autoplay-policy=no-user-gesture-required。没有use-file-for-fake-video-capture，画面是浏览器合成摄像头的绿色测试图。
- 这是单页连Rust回声服务，不是两浏览器直连，也不是Mode::Video的文件播放。

## 两轮实际结果

session-a，02:07:44.295到02:07:46.807 JST，同一连接、同一主SSRC，各值均为累计值：

| 方向 | SSRC | packets | bytes | 编码/解码帧 |
| --- | --- | --- | --- | --- |
| 上行 | 729981910 | 13→85 | 8516→67320 | framesEncoded 5→56 |
| 下行 | 5002 | 9→81 | 8512→67316 | framesDecoded 2→55 |

远端元素绑定接收轨道，与本地流不同。t2为640×480、paused=false、totalVideoFrames=55。实际answer保留PT96 VP8/90000和PT97 RTX，apt=96，视频端口非0、sendrecv。codec统计也映射PT96到video/VP8。

session-b是新Chrome会话，无pause/play干预。02:07:50.691到02:07:53.203 JST，上行SSRC2189810431包数18→90、framesEncoded7→57；下行SSRC5004包数14→86、framesDecoded2→56。远端640×480、paused=false、totalVideoFrames=56。

两轮浏览器transport统计均有ICE/DTLS connected，selected pair为nominated、succeeded的host/host UDP。服务端没有成功DTLS握手日志，没有补造。dtlsCipher是TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256，srtpCipher是SRTP_AES128_CM_HMAC_SHA1_80，二者独立记录。

## 暂停反例

session-a在02:07:46.907 JST只暂停远端元素。前后采样02:07:46.906到02:07:49.420 JST，本地采集live，连接connected：

| 字段 | 前 | 后 |
| --- | --- | --- |
| 远端paused | false | true |
| 呈现回调计数 | 46 | 46 |
| 元素totalVideoFrames | 57 | 57 |
| 元素webkitDecodedFrameCount | 57 | 57 |
| inbound-rtp framesDecoded | 57 | 107 |
| inbound-rtp packetsReceived | 85 | 168 |
| 上行framesEncoded | 58 | 108 |
| inbound-rtp pauseCount | 0 | 0 |
| inbound-rtp totalPausesDuration | 0 | 0 |

接收/解码与元素播放不同。pauseCount不是元素pause方法调用次数。framesRendered在本轮inbound对象中未出现，未补成0。没有从这些样本推导性能或精确回声时延。

## 文件与脚本

- session-a-stats.json、session-b-stats.json是实际脱敏记录的字段白名单副本。只保留本课所需的统计、元素状态、轨道绑定判据和候选类别，没有地址、凭证、完整SDP或私人画面。
- sdp-excerpts.md是脱敏截取，含不可部署的[port]标记，不是完整SDP。
- page-getstats.js记录云端真实执行的表达式。先在点击Start之前执行构造函数包装，再在点击之后执行采样部分，不能一次运行整个文件。原页面没有window.pc。
- 三张PNG是本轮真实视频区域截图。暂停图中远端图内时间停在0:00:03:050，本地走到0:00:05:650。不是生成图，也不是旧聊天截图。

## 未验证

未测Windows、真人摄像头、麦克风、音频回声、跨公网穿透或性能。没有抓线上序列号，不声称对照过包序号。源码中Rust发送端会改写SSRC和序列号，不把编码负载解码成像素；这是固定源码判读，不是伪装的抓包结果。
