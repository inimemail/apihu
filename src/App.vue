<template>
  <div id="codex-mist-page">
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#top" :aria-label="siteConfig.brandName">
          <span class="brand-icon">{{ siteConfig.brandIcon }}</span>
          <span>{{ siteConfig.brandName }}</span>
        </a>
        <nav class="nav" aria-label="页面导航">
          <a href="#pricing">套餐</a>
          <a href="#tutorial">教程</a>
          <a href="#chat-panel">Chat</a>
        </nav>
      </div>
    </header>

    <main id="top" class="wrap">
      <!-- 英雄主视觉区 -->
      <section class="hero">
        <div class="badge animate-enter">
          <i class="badge-dot"></i>
          <span>✨ AI 订阅与 API 服务平台</span>
        </div>
        <h1 class="title animate-enter animated-title" :aria-label="siteConfig.brandName">
          <span v-for="(char, index) in brandLetters" :key="`${char}-${index}`" :style="{ '--i': index + 1 }">{{ char
            }}</span>
        </h1>
        <p class="subtitle animate-enter">稳定、安全、即开即用的 AI API 服务平台</p>
        <div class="hero-actions animate-enter">
          <a class="btn btn-primary" href="#pricing">立即购买</a>
          <a class="btn btn-secondary" href="#tutorial">查看教程</a>
          <a class="btn btn-secondary" :href="siteConfig.dashboardUrl" target="_blank" rel="noopener">进入使用</a>
        </div>
      </section>

      <!-- 特性区 -->
      <section class="features">
        <article class="card animate-enter">
          <div class="icon-box">🛡️</div>
          <h3>安全</h3>
          <p>不保存对话内容，仅做请求中转；权限可控，降低使用风险。</p>
        </article>
        <article class="card animate-enter">
          <div class="icon-box">⚡</div>
          <h3>稳定</h3>
          <p>稳定运行，监控告警及时；业务持续跑更省心。</p>
        </article>
        <article class="card animate-enter">
          <div class="icon-box">🎁</div>
          <h3>优惠</h3>
          <p>套餐清晰、价格透明；按需购买更划算，成本可控。</p>
        </article>
        <article class="card animate-enter">
          <div class="icon-box">✅</div>
          <h3>售后</h3>
          <p>有群答疑、专人对接与技术支持；问题有人跟到解决。</p>
        </article>
      </section>

      <!-- 套餐购买区 -->
      <section id="pricing" class="pricing">
        <div class="section-head animate-enter">
          <h2>购买套餐</h2>
        </div>

        <div v-if="catalogError" class="error-text catalog-error">{{ catalogError }}</div>
        <div v-if="catalogLoading" class="catalog-loading">正在加载套餐...</div>

        <div v-else class="pricing-grid">
          <div v-for="(row, rowIndex) in productRows" :key="rowIndex" class="pricing-row">

            <article v-for="product in row" :key="product.id" class="price-card animate-enter"
              :class="{ popular: product.popular, 'balance-card': product.kind === 'balance' }">
              <div v-if="product.popular" class="popular-badge sweep-shine">强烈推荐</div>
              <div class="product-kind">{{ product.kind === 'balance' ? '余额计费' : 'OpenAI 订阅' }}</div>

              <!-- 覆盖动态内容：如果是余额卡，采用合并视效 -->
              <template v-if="product.kind === 'balance'">
                <h3 class="price-title">通用按量余额</h3>
                <p class="price-sub">灵活计费，全平台模型通用</p>
                <div class="balance-visual">
                  <span>OpenAI</span>
                  <span>Claude</span>
                </div>
                <p class="price-num">自定义 <small>/ 按需购买</small></p>
              </template>

              <template v-else>
                <h3 class="price-title">{{ product.title }}</h3>
                <p class="price-sub">{{ product.subtitle }}</p>
                <p class="price-num">
                  {{ product.priceLabel.split(' / ')[0] }}
                  <small v-if="product.priceLabel.includes(' / ')">/ {{ product.priceLabel.split(' / ')[1] }}</small>
                </p>
              </template>

              <ul class="price-list">
                <li v-for="[label, value] in product.features" :key="label">
                  <!-- 如果是余额，覆盖显示支持平台 -->
                  <span v-if="label === '支持平台' && product.kind === 'balance'">支持平台</span>
                  <span v-else>{{ label }}</span>

                  <span v-if="label === '支持平台' && product.kind === 'balance'">OpenAI / Claude</span>
                  <span v-else>{{ value }}</span>
                </li>
                <li>
                  <span>支持模型</span>
                  <span>
                    <!-- 余额卡固定拉起合并全集，订阅卡拉起对应的单独集 -->
                    <button class="model-link" type="button"
                      @click="openModelModal(product.kind === 'balance' ? 'balance' : product.platform)">
                      查看列表
                    </button>
                  </span>
                </li>
              </ul>

              <!-- 核心：保留原版的 Vue 下单唤起逻辑 -->
              <button class="buy-btn" type="button" @click="startCheckout(product)">
                {{ product.kind === 'balance' ? '立即充值' : '立即购买' }}
              </button>
            </article>

            <!-- 余额扩展面板 -->
            <aside v-if="rowIndex === 0" class="balance-more-card animate-enter">
              <div class="more-card-head">
                <span class="cc-kicker">余额可扩展</span>
                <h3>更多模型按需申请开通</h3>
                <p>余额不仅能跑 OpenAI 和 Claude，其他热门模型也可以接入。部分模型需要联系客服开通对应分组后，再把 API Key 绑定到该分组。</p>
              </div>
              <div class="model-cloud">
                <span>Gemini</span>
                <span>Gork</span>
                <span>DeepSeek</span>
                <span>通义千问 / Qwen</span>
                <span>Kimi</span>
                <span>豆包 / Doubao</span>
                <span>智谱 GLM</span>
                <span>MiniMax</span>
                <span>腾讯混元</span>
                <span>文心 ERNIE</span>
              </div>
              <div class="more-list">
                <div><b>默认可用</b><span>OpenAI / Claude 额度计费分组</span></div>
                <div><b>热门扩展</b><span>Gemini、Gork、DeepSeek、通义千问、Kimi、豆包、GLM 等联系客服开启</span></div>
                <div><b>使用方式</b><span>充值余额后创建 Key，并绑定需要的模型分组</span></div>
              </div>
            </aside>

          </div>
        </div>
      </section>

      <!-- 教程区 -->
      <section id="tutorial" class="tutorial-shell animate-enter">
        <div class="section-head tutorial-head">
          <h2>使用教程</h2>
          <p>推荐使用 CC Switch 统一管理配置；OpenClaw 有单独适配说明。</p>
        </div>

        <div class="tab-row">
          <button class="tab-label" :class="{ active: tutorialTab === 'ccswitch' }" type="button"
            @click="tutorialTab = 'ccswitch'">CC Switch</button>
          <button class="tab-label" :class="{ active: tutorialTab === 'openclaw' }" type="button"
            @click="tutorialTab = 'openclaw'">OpenClaw / 龙虾</button>
        </div>

        <div v-if="tutorialTab === 'ccswitch'" class="pane visible">
          <div class="cc-hero">
            <div>
              <span class="cc-kicker">新手推荐</span>
              <h3>用 CC Switch 一次配置，多端同步</h3>
              <p>CC Switch 能统一管理 Codex CLI、OpenCode、OpenClaw、Claude Code、Gemini CLI。当前 {{ siteConfig.brandName }} 的订阅分类按
                OpenAI 兼容方式接入，余额用户也可按模型分类绑定 OpenAI 或 Claude 额度计费分组。</p>
            </div>
            <a class="cc-doc-link" :href="siteConfig.ccSwitchDownloadUrl" target="_blank" rel="noopener">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
              下载 CC Switch
            </a>
          </div>

          <div class="tutorial-guide">
            <article class="guide-step">
              <span class="guide-index">1</span>
              <div>
                <h3>准备环境</h3>
                <p>先安装 Node.js 18 或更高版本，再安装你要用的客户端。打开 CC Switch 后，确认左侧或顶部能看到「统一供应商」。</p>
                <ul>
                  <li>Windows：正常安装后从开始菜单打开。</li>
                  <li>macOS：首次打开如被拦截，到系统设置里允许。</li>
                  <li>打开后先不要急着切换，先添加 {{ siteConfig.brandName }}。</li>
                </ul>
              </div>
            </article>
            <article class="guide-step">
              <span class="guide-index">2</span>
              <div>
                <h3>添加 OpenAI 兼容供应商</h3>
                <p>进入「统一供应商」页面，点击「添加」。名称写 {{ siteConfig.brandName }}，接口地址写 <span class="inline-code">{{
                  siteConfig.gatewayBaseUrl }}</span>，Key 粘贴你后台密钥。</p>
                <ul>
                  <li>不要把邮箱密码填到 API Key。</li>
                  <li>Base URL 不要写成后台登录地址。</li>
                  <li>OpenAI 分类先选 <span class="inline-code">gpt-5.4</span>。</li>
                </ul>
              </div>
            </article>
            <article class="guide-step">
              <span class="guide-index">3</span>
              <div>
                <h3>选择同步应用</h3>
                <p>在同步目标里勾选你要用的客户端。Codex CLI 和 OpenCode 使用 OpenAI 兼容配置；OpenClaw 也可填自定义 OpenAI 网关。</p>
                <ul>
                  <li>Codex CLI 会写入 <span class="inline-code">~/.codex</span>。</li>
                  <li>OpenCode 会写入自己的配置文件。</li>
                  <li>如果提示无权限，重新以管理员身份打开 CC Switch。</li>
                </ul>
              </div>
            </article>
            <article class="guide-step">
              <span class="guide-index">4</span>
              <div>
                <h3>启用并测试</h3>
                <p>回到供应商列表，点击 {{ siteConfig.brandName }} 的「启用 / 切换」。然后重新打开对应客户端，发一句简单测试。</p>
                <ul>
                  <li>Codex CLI：切换后必须重开终端。</li>
                  <li>OpenCode：重新开一个会话即可。</li>
                  <li>报 401 多半是 Key 填错；报 404 多半是 Base URL 填错。</li>
                </ul>
              </div>
            </article>
          </div>

          <div class="cc-field-card">
            <div class="cc-field-head">
              <div>
                <span class="cc-kicker">照着填</span>
                <h3>统一供应商字段</h3>
              </div>
              <span>把 YOUR_API_KEY 换成你的后台密钥</span>
            </div>
            <div class="cc-fields">
              <div><span>名称</span><b>{{ siteConfig.brandName }}</b></div>
              <div><span>类型</span><b>OpenAI 兼容</b></div>
              <div><span>Base URL</span><b>{{ siteConfig.gatewayBaseUrl }}</b></div>
              <div><span>API Key</span><b>YOUR_API_KEY</b></div>
              <div><span>默认模型</span><b>gpt-5.4</b></div>
              <div><span>同步目标</span><b>Codex CLI / OpenCode</b></div>
            </div>
          </div>

          <div class="cc-tool-map">
            <div class="cc-field-head">
              <div>
                <span class="cc-kicker">怎么选</span>
                <h3>不同工具对应关系</h3>
              </div>
              <span>先按你要用的客户端选择，再确认 Key 绑定的模型分组</span>
            </div>
            <div class="tool-map-grid">
              <div>
                <b>Codex CLI</b>
                <span>走 OpenAI 兼容配置。订阅套餐就是 OpenAI 分类，模型用 gpt 系列。</span>
              </div>
              <div>
                <b>OpenCode</b>
                <span>走 OpenAI 兼容配置。Base URL 填网关根地址，模型用 OpenAI 分类模型。</span>
              </div>
              <div>
                <b>OpenClaw / 龙虾</b>
                <span>选择 Custom Provider，API URL 填 <span class="inline-code">{{ siteConfig.gatewayApiUrl
                    }}</span>，必要时降级参数。</span>
              </div>
              <div>
                <b>Claude Code</b>
                <span>如果使用 Claude 模型，Key 要绑定 Claude 额度计费分组。</span>
              </div>
            </div>
          </div>

          <div class="cc-checks">
            <div>
              <b>第一步验证</b>
              <span>点击「获取模型」，能看到模型列表就说明 Base URL 和 Key 基本正确。</span>
            </div>
            <div>
              <b>第二步验证</b>
              <span>点击「保存并同步」，没有权限错误就说明配置写入成功。</span>
            </div>
            <div>
              <b>第三步验证</b>
              <span>重启终端后运行 Codex CLI，问一句“你当前是什么模型”，确认能正常响应。</span>
            </div>
          </div>

          <details class="cc-details">
            <summary>高级用户：查看同步后的配置参考</summary>
            <CodeCard title="Codex CLI 同步后的 OpenAI 配置" :code="ccSwitchCodexConfig" />
            <CodeCard title="OpenCode 同步后的关键配置" :code="ccSwitchOpenCodeConfig" />
          </details>

          <div class="guide-notes">
            <div>
              <b>Key 从哪里来</b>
              <span>登录 {{ siteConfig.brandName }} 后台，在 API 密钥页面创建 Key。订阅套餐绑定订阅分组；余额用户绑定额度分组。</span>
            </div>
            <div>
              <b>切换不生效</b>
              <span>Codex CLI 切换 OpenAI 供应商后需要关闭并重新打开终端；OpenCode 重新开会话即可。</span>
            </div>
            <div>
              <b>需要代理时</b>
              <span>需要日志、用量统计或故障转移时，可开启本地代理，默认服务地址是 <span class="inline-code">http://127.0.0.1:15721</span>。</span>
            </div>
          </div>
        </div>

        <div v-else class="pane visible">
          <div class="warn">
            <div><b>专用网关与路由适配</b></div>
            <div>在使用 OpenClaw 客户端时，请将 Provider 切换至 <span class="inline-code">Custom Provider</span>，并绑定专用路由地址。</div>
          </div>
          <CodeCard title="基础调用设置" :code="openclawConfig" :copyable="false" />

          <div class="warn" style="background: #f8fafc; border-color: #cbd5e1; color: #334155; margin-top: 32px;">
            <div>🛠️ <b>异常排查指南 (请按先后顺序执行)</b></div>
          </div>
          <CodeCard title="第一步：参数降级 (解决报错或解析失败)" :code="openclawToolsConfig" />
          <CodeCard title="第二步：网络伪装 (解决 403 阻断或防火墙拦截)" :code="openclawHeadersConfig" />
        </div>
      </section>

      <!-- Chat 面板区 -->
      <section id="chat-panel" class="chat-section animate-enter">
        <div class="section-head">
          <h2>{{ siteConfig.chatName }} 面板</h2>
          <p>无需繁琐配置，只需输入网关地址 <span class="mono-strong">{{ siteConfig.gatewayApiUrl }}</span> 和您的 Key 即可极速开启对话。</p>
        </div>

        <div class="chat-showcase-card">
          <div class="chat-showcase-inner">
            <div class="chat-browser-frame">
              <div class="browser-bar">
                <span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="browser-url">{{ chatHost }}</span>
              </div>
              <img :src="siteConfig.chatPcImageUrl" :alt="`${siteConfig.chatName} PC 端`" class="img-pc" />
            </div>
            <div class="chat-phone-frame">
              <span class="phone-speaker" aria-hidden="true"></span>
              <img :src="siteConfig.chatMobileImageUrl" :alt="`${siteConfig.chatName} 移动端`" class="img-mobile" />
            </div>
          </div>
        </div>

        <div class="chat-benefits">
          <div class="benefit-card"><b>纯前端</b> <span>本地保存配置</span></div>
          <div class="benefit-card"><b>多端适配</b> <span>桌面与移动端可用</span></div>
          <div class="benefit-card"><b>OpenAI</b> <span>支持图像模型</span></div>
        </div>

        <div class="hero-actions chat-actions">
          <a class="btn btn-primary" :href="siteConfig.chatUrl" target="_blank" rel="noopener">前往 {{ siteConfig.chatName
            }}</a>
        </div>
      </section>
    </main>

    <!-- 模型弹窗 -->
    <div v-if="modelModal" class="modal visible model-modal" role="dialog" aria-modal="true"
      @click.self="modelModal = null">
      <div class="modal-box" @wheel.stop>
        <div class="modal-head">
          <h3 class="modal-title">{{ modelModalTitle }} <span>({{ activeModelCount }} 个)</span></h3>
          <button class="modal-close" type="button" @click="modelModal = null">×</button>
        </div>
        <div class="table-header">
          <div>模型 ID</div>
          <div>分类</div>
          <div>状态</div>
        </div>
        <div class="modal-body">
          <template v-for="section in activeModelSections" :key="section.label">
            <div v-for="model in section.models" :key="`${section.label}-${model}`" class="model-item">
              <div>{{ model }}</div>
              <div class="tag-group">
                <!-- 动态解析标签样式 -->
                <span class="tag"
                  :class="section.label === 'Claude' ? 'tag-orange' : (model.includes('image') ? 'tag-purple' : (model.includes('codex') ? 'tag-blue' : 'tag-gray'))">
                  {{ section.label === 'Claude' ? 'Claude' : (model.includes('image') ? 'Image' :
                    (model.includes('codex') ? 'Codex' : 'GPT-5')) }}
                </span>
              </div>
              <div class="tag-group"><span class="tag tag-green">可用</span></div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 下单支付弹窗 (保留底层逻辑) -->
    <div v-if="checkoutVisible" class="modal visible checkout-modal" role="dialog" aria-modal="true"
      @click.self="closeCheckout">
      <div class="modal-box checkout-box" @wheel.stop>
        <div class="modal-head">
          <div>
            <h3 class="modal-title">{{ selectedProduct?.title || '购买' }}</h3>
            <p class="modal-subtitle">{{ selectedProduct?.subtitle }}</p>
          </div>
          <button class="modal-close" type="button" @click="closeCheckout">×</button>
        </div>

        <!-- Checkout Form Step -->
        <div v-if="checkoutStep === 'form'" class="checkout-form">
          <label class="field">
            <span>邮箱</span>
            <input v-model.trim="buyerEmail" type="email" placeholder="you@example.com" autocomplete="email" />
          </label>
          <label v-if="accountMode === 'login'" class="field">
            <span>账号密码</span>
            <input v-model="buyerPassword" type="password" placeholder="请输入该邮箱已有账号密码" autocomplete="current-password" />
          </label>
          <div v-if="accountMode === 'login'" class="login-hint">
            这个邮箱已经注册过，请输入密码登录后购买；支付成功后会充值到这个账号。
          </div>
          <label v-if="selectedProduct?.kind === 'balance'" class="field">
            <span>充值金额</span>
            <input v-model.number="balanceAmount" type="number" min="1" step="1" />
          </label>
          <label class="field">
            <span>支付方式</span>
            <select v-model="paymentType">
              <option v-for="method in catalog?.methods || defaultPaymentMethods" :key="method.id" :value="method.id">{{
                method.label }}</option>
            </select>
          </label>
          <div class="order-summary">
            <div><span>商品</span><b>{{ selectedProduct?.title }}</b></div>
            <div><span>类型</span><b>{{ selectedProduct?.kind === 'balance' ? '余额充值' : '订阅套餐' }}</b></div>
            <div><span>{{ selectedProduct?.kind === 'balance' ? '支付金额' : '预计金额' }}</span><b>{{ selectedProduct?.kind === 'balance' ? formatCny(validBalanceAmount) :
                selectedProduct?.priceLabel }}</b></div>
            <div v-if="selectedProduct?.kind === 'balance'"><span>到账余额</span><b>{{ formatUsd(balanceCreditedAmount) }}</b></div>
            <p v-if="selectedProduct?.kind === 'balance'" class="recharge-rate-line">
              当前倍率：充值 {{ formatCny(1) }} 到账 {{ formatUsd(balanceRechargeMultiplier) }}
            </p>
            <div v-if="selectedProduct?.kind === 'balance'"><span>可用范围</span><b>OpenAI / Claude 额度计费</b></div>
          </div>
          <p v-if="checkoutError" class="error-text">{{ checkoutError }}</p>
          <button class="btn btn-primary checkout-submit" type="button" :disabled="submitting" @click="submitCheckout">
            {{ submitButtonText }}
          </button>
        </div>

        <!-- Paying Step -->
        <div v-else-if="checkoutStep === 'paying'" class="payment-panel">
          <div class="pay-status">
            <span class="status-dot"></span>
            <div>
              <h4>{{ orderStatusTitle }}</h4>
              <p>{{ orderStatusText }}</p>
            </div>
            <span v-if="paymentCountdownText && !isTerminalOrder" class="pay-countdown">{{ paymentCountdownText
              }}</span>
          </div>
          <div v-if="qrDataUrl" class="qr-wrap">
            <img :src="qrDataUrl" alt="支付二维码" />
          </div>
          <a v-if="activeOrder?.pay_url" class="btn btn-secondary pay-link" :href="activeOrder.pay_url" target="_blank"
            rel="noopener">
            打开支付页面
          </a>
          <div class="order-summary">
            <div><span>订单号</span><b>{{ activeOrder?.out_trade_no || activeOrder?.order_id }}</b></div>
            <div><span>应付</span><b>{{ formatCurrency(activeOrder?.pay_amount || 0, activeOrder?.currency) }}</b></div>
            <div v-if="latestOrder?.order_type === 'balance'"><span>到账余额</span><b>{{ formatUsd(Number(activeOrder?.amount || latestOrder?.amount || 0)) }}</b></div>
            <div><span>状态</span><b>{{ latestOrder?.status || 'PENDING' }}</b></div>
          </div>
          <p v-if="checkoutError" class="error-text">{{ checkoutError }}</p>
          <div class="payment-actions">
            <button class="btn btn-secondary" type="button" :disabled="cancelling || isTerminalOrder"
              @click="() => cancelCurrentOrder()">
              {{ cancelling ? '正在取消...' : '取消订单' }}
            </button>
            <button class="btn btn-primary" type="button" :disabled="checking || isTerminalOrder"
              @click="() => checkPaymentNow()">
              {{ checking ? '正在核验...' : '我已支付，检查到账' }}
            </button>
          </div>
          <button v-if="isTerminalOrder" class="btn btn-secondary checkout-submit" type="button"
            @click="resetCheckoutForm">
            重新选择支付
          </button>
        </div>

        <!-- Success Step -->
        <div v-else class="success-panel">
          <div class="success-mark">✓</div>
          <h3>支付成功，{{ issuedCredential?.isExisting ? '已充值到当前账号' : '账号已开通' }}</h3>
          <p>请保存下面的登录信息，套餐或余额已由后端支付系统自动到账。</p>
          <div class="credential-box">
            <div><span>账号邮箱</span><b>{{ issuedCredential?.email }}</b></div>
            <div v-if="!issuedCredential?.isExisting"><span>登录密码</span><b>{{ issuedCredential?.password }}</b></div>
            <div v-else><span>到账账号</span><b>已有账号</b></div>
          </div>
          <div class="success-actions">
            <button v-if="!issuedCredential?.isExisting" class="btn btn-secondary" type="button"
              @click="copyCredential">复制账号密码</button>
            <a class="btn btn-primary" :href="siteConfig.dashboardUrl" target="_blank" rel="noopener">去登录后台</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'

// 这里的引入保持你原文件的对应相对路径，如果之前是同目录API则无需改动
import { cancelCheckoutOrder, checkCheckoutOrder, createCheckoutOrder, errorMessage, getCatalog, getCheckoutOrder } from './api'
import { isValidEmail } from './account'
import { catalogToProducts, fallbackCatalog, fallbackPaymentMethods, modelGroups, normalizeCatalog } from './products'
import { chatHost, siteConfig } from './siteConfig'
import type { AccountCredential, CatalogResponse, CreateOrderResult, OrderType, PaymentOrder, Product } from './types'

const brandLetters = computed(() => Array.from(siteConfig.brandName))

const CodeCard = defineComponent({
  name: 'CodeCard',
  props: {
    title: { type: String, required: true },
    code: { type: String, required: true },
    copyable: { type: Boolean, default: true },
  },
  setup(props) {
    const copied = ref(false)
    const copy = async () => {
      await navigator.clipboard.writeText(props.code)
      copied.value = true
      window.setTimeout(() => { copied.value = false }, 1600)
    }
    return () => h('div', { class: 'code-card' }, [
      props.copyable ? h('button', { class: ['copy-btn', copied.value ? 'copied' : ''], type: 'button', onClick: copy }, copied.value ? '已复制' : '复制') : null,
      h('div', { class: 'code-head' }, props.title),
      h('pre', props.code),
    ])
  },
})

// 原有产品数据流与生命周期
const catalog = ref<CatalogResponse>(fallbackCatalog)
const catalogLoading = ref(false)
const catalogError = ref('')
const defaultPaymentMethods = fallbackPaymentMethods
const products = computed(() => catalogToProducts(catalog.value))

// 为了实现“通用按量余额”的合并效果，我们将获取到的数据进行处理，保留展示逻辑
// 核心逻辑：UI只会在 rowIndex === 0 显示合并好的样式
const productRows = computed(() => {
  const list = products.value
  return [
    list.slice(0, 1), // 这里强制只传一个 balance 给第 1 行渲染，因为模板里会直接将它覆写为通用余额
    list.slice(1, 4),
    list.slice(4, 7),
  ].filter((row) => row.length > 0)
})

const tutorialTab = ref<'ccswitch' | 'openclaw'>('ccswitch')
const modelModal = ref<'openai' | 'claude' | 'balance' | null>(null)

// 动态合并弹窗模型列表数据
const activeModelSections = computed(() => {
  if (modelModal.value === 'balance') {
    return [
      { label: 'OpenAI', models: modelGroups.openai },
      { label: 'Claude', models: modelGroups.claude },
    ]
  }
  if (modelModal.value === 'claude') {
    return [{ label: 'Claude', models: modelGroups.claude }]
  }
  return [{ label: 'OpenAI', models: modelGroups.openai }]
})
const activeModelCount = computed(() => activeModelSections.value.reduce((total, section) => total + section.models.length, 0))
const modelModalTitle = computed(() => {
  if (modelModal.value === 'balance') return '余额计费可用模型'
  if (modelModal.value === 'claude') return 'Claude 分类可用模型'
  return 'OpenAI 分类可用模型'
})

function openModelModal(platform: 'openai' | 'claude' | 'balance') {
  modelModal.value = platform
}

const checkoutVisible = ref(false)
const checkoutStep = ref<'form' | 'paying' | 'success'>('form')
const accountMode = ref<'auto' | 'login'>('auto')
const selectedProduct = ref<Product | null>(null)
const buyerEmail = ref('')
const buyerPassword = ref('')
const balanceAmount = ref(20)
const paymentType = ref('alipay')
const submitting = ref(false)
const checking = ref(false)
const cancelling = ref(false)
const checkoutError = ref('')
const activeOrder = ref<CreateOrderResult | null>(null)
const latestOrder = ref<PaymentOrder | null>(null)
const issuedCredential = ref<AccountCredential | null>(null)
const qrDataUrl = ref('')
const activeCheckoutId = ref('')
const nowMs = ref(Date.now())

let pollTimer: number | null = null
let clockTimer: number | null = null
let previousBodyOverflow = ''

const pageScrollLocked = computed(() => Boolean(modelModal.value || checkoutVisible.value))

function lockPageScroll(locked: boolean): void {
  if (typeof document === 'undefined') return
  if (locked) {
    if (!document.body.classList.contains('codex-modal-open')) {
      previousBodyOverflow = document.body.style.overflow
    }
    document.body.classList.add('codex-modal-open')
    document.body.style.overflow = 'hidden'
    return
  }
  document.body.classList.remove('codex-modal-open')
  document.body.style.overflow = previousBodyOverflow
}

// 动态计算属性，绑定为最新的域名
const ccSwitchCodexConfig = computed(() => `CC Switch 同步到 Codex CLI 后，会写入 OpenAI 兼容供应商配置：

~/.codex/config.toml
~/.codex/auth.json

关键配置等价于：

model_provider = "ahuapi"
model = "gpt-5.4"
model_reasoning_effort = "high"
network_access = "enabled"
disable_response_storage = true
windows_wsl_setup_acknowledged = true
model_verbosity = "high"

[model_providers.ahuapi]
name = "ahuapi"
base_url = "${siteConfig.gatewayBaseUrl}"
wire_api = "responses"
requires_openai_auth = true

auth.json 中保存：
{
  "OPENAI_API_KEY": "YOUR_API_KEY"
}`)

const ccSwitchOpenCodeConfig = computed(() => `CC Switch 同步到 OpenCode 后，会写入 OpenAI 兼容供应商配置。

关键配置等价于：

{
  "provider": {
    "openai": {
      "options": {
        "baseURL": "${siteConfig.gatewayBaseUrl}",
        "apiKey": "YOUR_API_KEY"
      },
      "models": {
        "gpt-5.4": {
          "name": "gpt-5.4",
          "options": {
            "store": false
          }
        }
      }
    }
  }
}`)

const openclawConfig = computed(() => `Provider : Custom Provider
apiurl   : ${siteConfig.gatewayApiUrl}
apikey   : YOUR_API_KEY
Model    : gpt-5.4`)

const openclawToolsConfig = `"tools": {
  "profile": "minimal"
}`

const openclawHeadersConfig = computed(() => `"baseURL": "${siteConfig.gatewayApiUrl}",
"headers": {
  "User-Agent": "curl/8.0.1"
}`)

const orderStatusTitle = computed(() => {
  const status = latestOrder.value?.status || 'PENDING'
  if (status === 'COMPLETED') return '到账完成'
  if (status === 'PAID' || status === 'RECHARGING') return '已支付，正在开通'
  if (status === 'CANCELLED') return '订单已取消'
  if (status === 'FAILED') return '订单处理失败'
  if (status === 'EXPIRED') return '订单已过期'
  return '等待支付'
})

const orderStatusText = computed(() => {
  const status = latestOrder.value?.status || 'PENDING'
  if (status === 'COMPLETED') return '后端已确认支付并完成套餐/余额发放。'
  if (status === 'PAID' || status === 'RECHARGING') return '支付已确认，正在完成到账，请稍等。'
  if (status === 'CANCELLED') return '你已取消本次订单，可以重新选择支付方式或重新下单。'
  if (status === 'FAILED') return '支付或到账处理失败，请联系售后处理。'
  if (status === 'EXPIRED') return '当前订单已超时，请重新下单。'
  return '请完成支付，页面会自动检查订单状态。'
})

const isTerminalOrder = computed(() => {
  const status = latestOrder.value?.status
  return status === 'COMPLETED' || status === 'CANCELLED' || status === 'FAILED' || status === 'EXPIRED'
})

const validBalanceAmount = computed(() => {
  const amount = Number(balanceAmount.value || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
})

const balanceRechargeMultiplier = computed(() => {
  const multiplier = Number(catalog.value?.balance?.multiplier || 1)
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
})

const balanceCreditedAmount = computed(() => roundMoney(validBalanceAmount.value * balanceRechargeMultiplier.value))

const paymentCountdownText = computed(() => {
  if (!latestOrder.value?.expires_at || isTerminalOrder.value) return ''
  const expiresAt = new Date(latestOrder.value.expires_at).getTime()
  if (!Number.isFinite(expiresAt)) return ''
  const remaining = Math.max(0, expiresAt - nowMs.value)
  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)
  return remaining > 0
    ? `剩余 ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : '已超时'
})

const submitButtonText = computed(() => {
  if (submitting.value) return accountMode.value === 'login' ? '正在登录并创建订单...' : '正在创建订单...'
  return accountMode.value === 'login' ? '登录并支付' : '提交并支付'
})

function startCheckout(product: Product): void {
  stopPolling()
  selectedProduct.value = product
  accountMode.value = 'auto'
  buyerEmail.value = ''
  buyerPassword.value = ''
  balanceAmount.value = product.amount || 20
  paymentType.value = catalog.value.methods?.[0]?.id || 'alipay'
  checkoutError.value = ''
  activeCheckoutId.value = ''
  activeOrder.value = null
  latestOrder.value = null
  issuedCredential.value = null
  qrDataUrl.value = ''
  checkoutStep.value = 'form'
  checkoutVisible.value = true
}

function closeCheckout(): void {
  checkoutVisible.value = false
  if (checkoutStep.value !== 'paying') stopPolling()
}

function resetCheckoutForm(): void {
  stopPolling()
  clearRecovery()
  activeOrder.value = null
  latestOrder.value = null
  activeCheckoutId.value = ''
  qrDataUrl.value = ''
  accountMode.value = 'auto'
  buyerPassword.value = ''
  checkoutError.value = ''
  checkoutStep.value = 'form'
}

function formatCurrency(value: number, currency = 'CNY'): string {
  const code = currency || 'CNY'
  if (code.toUpperCase() === 'USD') return `$${value.toFixed(2)}`
  return `¥${value.toFixed(2)}`
}

function formatCny(value: number): string {
  return `¥${roundMoney(value).toFixed(2)}`
}

function formatUsd(value: number): string {
  return `$${roundMoney(value).toFixed(2)}`
}

function roundMoney(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100
}

async function submitCheckout(): Promise<void> {
  if (!selectedProduct.value || submitting.value) return
  checkoutError.value = ''

  if (!isValidEmail(buyerEmail.value)) {
    checkoutError.value = '请输入有效邮箱。'
    return
  }

  if (accountMode.value === 'login' && !buyerPassword.value.trim()) {
    checkoutError.value = '请输入该邮箱账号的登录密码。'
    return
  }

  if (selectedProduct.value.kind === 'balance' && (!balanceAmount.value || balanceAmount.value <= 0)) {
    checkoutError.value = '请输入有效充值金额。'
    return
  }

  submitting.value = true
  try {
    const result = await createCheckoutOrder({
      email: buyerEmail.value,
      password: accountMode.value === 'login' ? buyerPassword.value : undefined,
      product_id: selectedProduct.value.id,
      order_type: selectedProduct.value.kind,
      amount: selectedProduct.value.kind === 'balance' ? Number(balanceAmount.value) : undefined,
      payment_type: paymentType.value as 'alipay' | 'wxpay',
      is_mobile: isMobile(),
    })
    activeCheckoutId.value = result.checkout_id
    issuedCredential.value = result.credential
    const order = result.order
    activeOrder.value = order
    latestOrder.value = {
      id: order.order_id || order.id || 0,
      amount: order.amount,
      pay_amount: order.pay_amount,
      fee_rate: order.fee_rate,
      currency: order.currency,
      payment_type: order.payment_type || paymentType.value,
      out_trade_no: order.out_trade_no || '',
      status: 'PENDING',
      order_type: selectedProduct.value.kind,
      created_at: new Date().toISOString(),
      expires_at: order.expires_at,
    }
    saveRecovery(result.credential, selectedProduct.value, result.checkout_id, order)
    await renderOrderQR(order)
    checkoutStep.value = 'paying'
    startPolling()
    if (order.pay_url && !order.qr_code) {
      window.open(order.pay_url, 'ahuapi-pay', 'popup=yes,width=520,height=720')
    }
  } catch (err) {
    if (err instanceof Error && 'reason' in err && (err as { reason?: string }).reason === 'PASSWORD_REQUIRED') {
      accountMode.value = 'login'
      buyerPassword.value = ''
    }
    checkoutError.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}

function isMobile(): boolean {
  return /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

async function renderOrderQR(order: CreateOrderResult): Promise<void> {
  const payload = order.qr_code || ''
  if (!payload) {
    qrDataUrl.value = ''
    return
  }
  qrDataUrl.value = await QRCode.toDataURL(payload, {
    width: 260,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
  await nextTick()
}

function startPolling(): void {
  stopPolling()
  pollTimer = window.setInterval(() => {
    void checkPaymentNow(false)
  }, 3000)
  startClock()
}

function stopPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function startClock(): void {
  stopClock()
  nowMs.value = Date.now()
  clockTimer = window.setInterval(() => {
    nowMs.value = Date.now()
    if (!isTerminalOrder.value && latestOrder.value?.expires_at) {
      const expiresAt = new Date(latestOrder.value.expires_at).getTime()
      if (Number.isFinite(expiresAt) && expiresAt <= nowMs.value) {
        void cancelCurrentOrder('EXPIRED')
      }
    }
  }, 1000)
}

function stopClock(): void {
  if (clockTimer !== null) {
    window.clearInterval(clockTimer)
    clockTimer = null
  }
}

async function checkPaymentNow(showLoading = true): Promise<void> {
  const checkoutId = activeCheckoutId.value
  if (!checkoutId) return
  if (showLoading) checking.value = true
  try {
    const state = await checkCheckoutOrder(checkoutId)
    applyCheckoutState(state)
    const status = state.status || state.order.status
    if (status === 'COMPLETED') {
      stopPolling()
      stopClock()
      checkoutStep.value = 'success'
      clearRecovery()
    } else if (status === 'CANCELLED' || status === 'FAILED' || status === 'EXPIRED') {
      stopPolling()
      stopClock()
      clearRecovery()
    }
  } catch (err) {
    if (showLoading) {
      checkoutError.value = errorMessage(err)
    }
  } finally {
    if (showLoading) checking.value = false
  }
}

async function cancelCurrentOrder(reason: 'USER' | 'EXPIRED' = 'USER'): Promise<void> {
  const checkoutId = activeCheckoutId.value
  if (!checkoutId || cancelling.value || isTerminalOrder.value) return
  checkoutError.value = ''
  cancelling.value = true
  try {
    const state = await cancelCheckoutOrder(checkoutId)
    stopPolling()
    stopClock()
    clearRecovery()
    applyCheckoutState(state)
    if (reason === 'EXPIRED') {
      checkoutError.value = '订单已超时，系统已自动取消；如果这是新注册账号，也会自动清理。'
    }
  } catch (err) {
    checkoutError.value = errorMessage(err)
  } finally {
    cancelling.value = false
  }
}

function copyCredential(): void {
  if (!issuedCredential.value) return
  const text = `账号：${issuedCredential.value.email}\n密码：${issuedCredential.value.password}`
  void navigator.clipboard.writeText(text)
}

function applyCheckoutState(state: Awaited<ReturnType<typeof checkCheckoutOrder>>): void {
  activeCheckoutId.value = state.checkout_id
  issuedCredential.value = state.credential
  activeOrder.value = state.order as CreateOrderResult
  latestOrder.value = {
    id: state.order.order_id || state.order.id || 0,
    amount: state.order.amount,
    pay_amount: state.order.pay_amount,
    fee_rate: state.order.fee_rate,
    currency: state.order.currency,
    payment_type: state.order.payment_type || paymentType.value,
    out_trade_no: state.order.out_trade_no || '',
    status: (state.status || state.order.status || 'PENDING') as PaymentOrder['status'],
    order_type: (state.order.order_type || selectedProduct.value?.kind || 'balance') as OrderType,
    created_at: state.order.created_at || new Date().toISOString(),
    expires_at: state.order.expires_at,
    paid_at: state.order.paid_at,
    completed_at: state.order.completed_at,
    plan_id: state.order.plan_id,
  }
}

interface RecoveryState {
  credential: AccountCredential
  product: Product
  checkoutId: string
  order: CreateOrderResult
}

const RECOVERY_KEY = 'ahuapi_checkout_recovery'

function saveRecovery(credential: AccountCredential, product: Product, checkoutId: string, order: CreateOrderResult): void {
  const state: RecoveryState = { credential, product, checkoutId, order }
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(state))
}

function readRecovery(): RecoveryState | null {
  try {
    return JSON.parse(localStorage.getItem(RECOVERY_KEY) || 'null') as RecoveryState | null
  } catch {
    return null
  }
}

function clearRecovery(): void {
  localStorage.removeItem(RECOVERY_KEY)
}

async function loadCatalog(): Promise<void> {
  catalogLoading.value = true
  catalogError.value = ''
  try {
    const data = await getCatalog()
    const nextCatalog = normalizeCatalog(data)
    catalog.value = nextCatalog
    const defaultMethod = nextCatalog.methods.find((method) => method.id === paymentType.value) || nextCatalog.methods[0]
    if (defaultMethod) paymentType.value = defaultMethod.id
  } catch (err) {
    catalogError.value = errorMessage(err)
    catalog.value = normalizeCatalog(catalog.value)
  } finally {
    catalogLoading.value = false
  }
}

async function restorePaymentIfNeeded(): Promise<void> {
  const recovery = readRecovery()
  if (!recovery) return
  const params = new URLSearchParams(window.location.search)
  const returnedOutTradeNo = params.get('out_trade_no') || ''
  if (returnedOutTradeNo && recovery.order.out_trade_no && returnedOutTradeNo !== recovery.order.out_trade_no) {
    return
  }

  selectedProduct.value = recovery.product
  issuedCredential.value = recovery.credential
  activeCheckoutId.value = recovery.checkoutId || ''
  activeOrder.value = recovery.order
  checkoutVisible.value = true
  checkoutStep.value = 'paying'
  latestOrder.value = {
    id: recovery.order.order_id,
    amount: recovery.order.amount,
    pay_amount: recovery.order.pay_amount,
    fee_rate: recovery.order.fee_rate,
    currency: recovery.order.currency,
    payment_type: recovery.order.payment_type || '',
    out_trade_no: recovery.order.out_trade_no || '',
    status: 'PENDING',
    order_type: recovery.product.kind,
    created_at: new Date().toISOString(),
    expires_at: recovery.order.expires_at,
  }
  await renderOrderQR(recovery.order)
  startPolling()
  if (recovery.checkoutId) {
    try {
      const state = await getCheckoutOrder(recovery.checkoutId)
      applyCheckoutState(state)
    } catch {
      // 忽略过期会话
    }
  }
  await checkPaymentNow(false)
}

onMounted(() => {
  void loadCatalog()
  void restorePaymentIfNeeded()
})

watch(pageScrollLocked, lockPageScroll, { immediate: true })

onBeforeUnmount(() => {
  stopPolling()
  stopClock()
  lockPageScroll(false)
})
</script>

<style scoped>
#codex-mist-page {
  --bg-base: #ffffff;
  --line: #e5e7eb;
  --line-hover: #d1d5db;
  --text-main: #111111;
  --text-muted: #555555;
  --text-dim: #999999;
  --warn-bg: #fffbeb;
  --warn-border: #fde68a;
  --warn-text: #92400e;
  --accent: #111111;
  --accent-light: #f5f5f5;
  --accent-border: #e0e0e0;
  --radius: 10px;
  color: var(--text-main);
  min-height: 100vh;
  background-color: var(--bg-base);
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.035) 1px, transparent 1px);
  background-size: 40px 40px;
  background-position: center top;
}

@keyframes slideUpFade {
  0% {
    opacity: 0;
    transform: translateY(28px) scale(0.97);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% center;
  }

  100% {
    background-position: 200% center;
  }
}

@keyframes letter-wave {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

@keyframes levitate {

  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(-5px) rotate(2deg);
  }
}

@keyframes softPulse {

  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }

  50% {
    opacity: 0.85;
    transform: scale(1.06);
  }
}

@keyframes screenSheen {
  0% {
    transform: translateX(-140%) rotate(18deg);
  }

  55%,
  100% {
    transform: translateX(140%) rotate(18deg);
  }
}

@keyframes modalBackdropIn {
  from {
    opacity: 0;
    backdrop-filter: blur(0);
  }

  to {
    opacity: 1;
    backdrop-filter: blur(12px);
  }
}

@keyframes modalFloatIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes modelRowIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes badgeDotPulse {

  0%,
  100% {
    box-shadow: 0 0 0 3.5px #e2e8f0;
  }

  50% {
    box-shadow: 0 0 0 5px #e2e8f0;
  }
}

@keyframes shimmerBtn {
  0% {
    left: -100%;
  }

  100% {
    left: 200%;
  }
}

@keyframes slideUpFadeStep {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-enter {
  opacity: 0;
  animation: slideUpFade 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.sweep-shine {
  background: linear-gradient(110deg, #f0f0f0 20%, #fafafa 50%, #f0f0f0 80%);
  background-size: 200% auto;
  color: #111111;
  animation: shimmer 3s linear infinite;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.topbar-inner,
.wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding-left: 24px;
  padding-right: 24px;
}

.topbar-inner {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 20px;
  color: var(--text-main);
  text-decoration: none;
  letter-spacing: -0.3px;
}

.brand-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #111111;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.nav {
  display: flex;
  gap: 4px;
}

.nav a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 8px;
  transition: color 0.15s ease, background 0.15s ease;
}

.nav a:hover {
  color: var(--text-main);
  background: rgba(15, 23, 42, 0.06);
}

.wrap {
  padding-top: 60px;
  padding-bottom: 100px;
}

.hero {
  position: relative;
  text-align: center;
  padding: 60px 0 80px;
  overflow: hidden;
  z-index: 1;
}

.hero::before,
.hero::after {
  content: "";
  position: absolute;
  z-index: -1;
  border-radius: 999px;
  pointer-events: none;
  animation: softPulse 8s ease-in-out infinite;
}

.hero::before {
  width: 500px;
  height: 500px;
  left: -10%;
  top: -20%;
  background: radial-gradient(circle, rgba(0, 0, 0, 0.04), transparent 65%);
  filter: blur(40px);
}

.hero::after {
  width: 400px;
  height: 400px;
  right: -8%;
  bottom: -10%;
  background: radial-gradient(circle, rgba(0, 0, 0, 0.03), transparent 65%);
  filter: blur(40px);
  animation-delay: 3s;
}

/* Vercel Style Badge Interaction */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 18px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 28px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: default;
}

.badge-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #334155;
  box-shadow: 0 0 0 3.5px #e2e8f0;
  margin-right: 12px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  animation: badgeDotPulse 3s infinite;
}

.badge:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #2563eb;
  box-shadow: 0 8px 24px -6px rgba(37, 99, 235, 0.25);
  transform: translateY(-2px);
}

.badge:hover .badge-dot {
  width: 0;
  height: 0;
  opacity: 0;
  margin-right: 0;
  box-shadow: 0 0 0 0 transparent;
  animation: none;
}

.title {
  margin: 0 0 22px;
  font-size: 72px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -2px;
  color: var(--text-main);
  display: flex;
  justify-content: center;
}

.animated-title span {
  display: inline-block;
  animation: letter-wave 3.5s infinite cubic-bezier(0.45, 0, 0.55, 1);
  animation-delay: calc(var(--i, 0) * 0.15s);
}

.subtitle {
  max-width: 560px;
  margin: 0 auto 44px;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1.7;
  letter-spacing: 0.1px;
}

.hero-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  padding: 12px 26px;
  border-radius: 10px;
  text-decoration: none;
  font-size: 15px;
  font-weight: 700;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.btn:disabled {
  opacity: 0.55;
  cursor: wait;
  transform: none !important;
}

.btn-primary {
  background: #111111;
  color: #fff;
  border-color: #111111;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.btn-primary:hover:not(:disabled) {
  background: #333333;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
}

.btn-secondary {
  background: #fff;
  color: var(--text-main);
  border-color: #e0e0e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.btn-secondary:hover:not(:disabled) {
  border-color: #c0c0c0;
  background: #f5f5f5;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.features {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 100px;
  margin-top: 60px;
}

.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 28px 24px;
  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.28s ease, border-color 0.28s ease;
  position: relative;
  overflow: hidden;
}

.card:hover {
  border-color: #aaaaaa;
  transform: translateY(-5px);
  box-shadow: 0 12px 40px -8px rgba(0, 0, 0, 0.14), 0 4px 12px -4px rgba(0, 0, 0, 0.08);
}

.icon-box {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  font-size: 20px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  animation: levitate 4.5s ease-in-out infinite;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.card:hover .icon-box {
  transform: scale(1.15) translateY(-4px);
  background: #fff;
  border-color: #d1d5db;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.card h3,
.price-title {
  margin: 0 0 10px;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.card p,
.price-sub {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.65;
  font-size: 14px;
}

.section-head {
  text-align: center;
  margin-bottom: 48px;
}

.section-head h2 {
  margin: 0 0 14px;
  font-size: 36px;
  font-weight: 900;
  letter-spacing: -0.8px;
  color: var(--text-main);
}

.section-head p {
  margin: 0 auto;
  max-width: 600px;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1.7;
}

.pricing {
  margin-bottom: 100px;
}

.pricing-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
}

.pricing-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 24px;
  width: 100%;
  max-width: 1100px;
}

.price-card {
  flex: 1;
  min-width: 300px;
  max-width: 340px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 36px 28px;
  position: relative;
  display: flex;
  flex-direction: column;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  z-index: 1;
}

.price-card::after {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 18px;
  z-index: -1;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6), rgba(139, 92, 246, 0.6), rgba(236, 72, 153, 0.6));
  filter: blur(18px);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.price-card:hover {
  border-color: #cbd5e1;
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18);
  z-index: 10;
}

.price-card:hover::after {
  opacity: 0.6;
}

.price-card.popular {
  border: 2px solid #111;
  background: #fafafa;
  transform: scale(1.03);
  box-shadow: 0 12px 36px -8px rgba(0, 0, 0, 0.15);
}

.price-card.popular::after {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.7), rgba(239, 68, 68, 0.7), rgba(236, 72, 153, 0.7));
  opacity: 0.2;
  filter: blur(20px);
}

.price-card.popular:hover {
  transform: scale(1.05) translateY(-6px);
  border-color: #000;
}

.price-card.popular:hover::after {
  opacity: 0.85;
}

.balance-card {
  max-width: 400px;
  border-color: #ccc;
  background: #fafafa;
}

.balance-card::after {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.6), rgba(59, 130, 246, 0.6));
}

.balance-card .price-title {
  font-size: 26px;
}

.balance-card .price-sub {
  font-size: 14px;
  color: var(--text-muted);
}

.product-kind {
  width: fit-content;
  margin-bottom: 16px;
  padding: 4px 12px;
  border-radius: 999px;
  background: #f0f0f0;
  color: #555555;
  border: 1px solid #e0e0e0;
  font-size: 11px;
  font-weight: 800;
}

.balance-card .product-kind {
  background: #f0f0f0;
  color: #333333;
  border-color: #d0d0d0;
}

.balance-visual {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 20px 0 16px;
}

.balance-visual span {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 48px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  background: #f5f5f5;
  color: #111111;
  font-weight: 900;
  font-size: 14px;
}

.balance-visual span:last-child {
  border-color: #d0d0d0;
  background: #eeeeee;
  color: #333333;
}

.popular-badge {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 18px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  background: #111111;
  color: #ffffff;
  border: 1px solid #111111;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
  z-index: 2;
  animation: floatBadge 3s ease-in-out infinite, shimmer 3s linear infinite;
}

.price-title {
  font-size: 24px;
  font-weight: 800;
}

.price-sub {
  margin: 0 0 24px;
  min-height: 20px;
  font-size: 14px;
  color: var(--text-muted);
}

.price-num {
  margin: 0 0 24px;
  font-size: 38px;
  font-weight: 900;
  line-height: 1.1;
  font-family: var(--font-mono);
  color: var(--text-main);
}

.price-num small {
  font-size: 13px;
  color: var(--text-dim);
  font-weight: 500;
  font-family: var(--font-sans);
}

.price-list {
  margin: 0 0 28px;
  padding: 18px 0 0;
  list-style: none;
  flex-grow: 1;
  border-top: 1px solid var(--line);
}

.price-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  font-size: 14px;
  color: var(--text-muted);
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), color 0.3s ease;
}

.price-list li:last-child {
  border-bottom: none;
}

.price-card:hover .price-list li {
  transform: translateX(6px);
  color: var(--text-main);
}

.price-card:hover .price-list li:nth-child(even) {
  transform: translateX(8px);
}

.price-list li span:last-child {
  color: var(--text-main);
  font-weight: 700;
  font-family: var(--font-mono);
  transition: color 0.2s;
}

.price-list li:hover span:last-child {
  color: #2563eb;
}

.model-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: #111;
  cursor: pointer;
  font-weight: 700;
  font-family: var(--font-sans);
  transition: color 0.2s ease;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.model-link:hover {
  color: #2563eb;
}

.buy-btn {
  display: flex;
  width: 100%;
  justify-content: center;
  padding: 14px;
  border-radius: 12px;
  background: #f5f5f5;
  color: #111;
  border: 1px solid #e0e0e0;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.price-card:hover .buy-btn {
  background: #111;
  color: #fff;
  border-color: #111;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.price-card:hover .buy-btn:active {
  transform: scale(0.95);
}

.price-card.popular .buy-btn {
  background: #111;
  color: #fff;
  border-color: #111;
}

.price-card.popular:hover .buy-btn {
  background: #fff;
  color: #111;
  border-color: #111;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.balance-more-card {
  flex: 1;
  min-width: 320px;
  max-width: 580px;
  padding: 32px;
  border: 1px solid #bfdbfe;
  border-radius: 16px;
  background:
    radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.14), transparent 36%),
    radial-gradient(circle at 0% 100%, rgba(16, 185, 129, 0.12), transparent 34%),
    rgba(255, 255, 255, 0.92);
  box-shadow: 0 28px 70px -48px rgba(37, 99, 235, 0.45);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}

.balance-more-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 36px 80px -40px rgba(37, 99, 235, 0.55);
}

.more-card-head h3 {
  margin: 0 0 10px;
  color: var(--text-main);
  font-size: 26px;
  font-weight: 900;
}

.more-card-head p {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.75;
}

.model-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.model-cloud span {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.82);
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  transition: transform 0.2s, box-shadow 0.2s;
}

.balance-more-card:hover .model-cloud span:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.model-cloud span:nth-child(1) {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.model-cloud span:nth-child(2) {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.model-cloud span:nth-child(3) {
  background: #fdf2f8;
  border-color: #fbcfe8;
  color: #be185d;
}

.more-list {
  display: grid;
  gap: 10px;
}

.more-list div {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(248, 250, 252, 0.82);
  transition: background 0.3s;
}

.balance-more-card:hover .more-list div {
  background: #fff;
}

.more-list b {
  color: #111827;
  font-size: 13px;
}

.more-list span {
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}

/* Tutorial & Tabs */
.tutorial-shell {
  max-width: 860px;
  margin: 0 auto 100px;
  animation-delay: 0.8s;
}

.tutorial-head {
  margin-bottom: 26px;
}

.tab-row {
  display: flex;
  gap: 4px;
  margin-bottom: 32px;
  justify-content: center;
  background: #f0f0f0;
  border-radius: 12px;
  padding: 4px;
  border: 1px solid #e0e0e0;
}

.tab-label {
  padding: 10px 24px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-muted);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.tab-label.active {
  color: var(--text-main);
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
  transform: scale(1.02);
}

.tab-label:not(.active):hover {
  color: var(--text-main);
}

.pane.visible {
  animation: slideUpFade 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  display: block;
}

/* Staggered Content Animations inside Vue Panes */
.pane.visible .cc-hero {
  animation: slideUpFadeStep 0.4s 0.05s both;
}

.pane.visible .tutorial-guide .guide-step:nth-child(1) {
  animation: slideUpFadeStep 0.4s 0.1s both;
}

.pane.visible .tutorial-guide .guide-step:nth-child(2) {
  animation: slideUpFadeStep 0.4s 0.15s both;
}

.pane.visible .tutorial-guide .guide-step:nth-child(3) {
  animation: slideUpFadeStep 0.4s 0.2s both;
}

.pane.visible .tutorial-guide .guide-step:nth-child(4) {
  animation: slideUpFadeStep 0.4s 0.25s both;
}

.pane.visible .cc-field-card {
  animation: slideUpFadeStep 0.4s 0.3s both;
}

.pane.visible .cc-tool-map {
  animation: slideUpFadeStep 0.4s 0.35s both;
}

.pane.visible .cc-checks {
  animation: slideUpFadeStep 0.4s 0.4s both;
}

.pane.visible .cc-details {
  animation: slideUpFadeStep 0.4s 0.45s both;
}

.pane.visible>.warn:nth-child(1) {
  animation: slideUpFadeStep 0.4s 0.05s both;
}

.pane.visible>.code-card:nth-child(2) {
  animation: slideUpFadeStep 0.4s 0.1s both;
}

.pane.visible>.warn:nth-child(3) {
  animation: slideUpFadeStep 0.4s 0.15s both;
}

.pane.visible>.code-card:nth-child(4) {
  animation: slideUpFadeStep 0.4s 0.2s both;
}

.pane.visible>.code-card:nth-child(5) {
  animation: slideUpFadeStep 0.4s 0.25s both;
}

.cc-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 28px;
  margin-bottom: 24px;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  background: radial-gradient(circle at 100% 0%, rgba(37, 99, 235, 0.08), transparent 50%), linear-gradient(135deg, #ffffff, #f0f7ff);
  box-shadow: 0 10px 30px -10px rgba(37, 99, 235, 0.1);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s;
}

.cc-hero:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -15px rgba(37, 99, 235, 0.2);
}

.cc-kicker {
  display: inline-flex;
  margin-bottom: 12px;
  padding: 4px 12px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 800;
  border: 1px solid #bfdbfe;
}

.cc-hero h3 {
  margin: 0;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.5px;
}

.cc-hero p {
  margin: 12px 0 0;
  color: #475569;
  line-height: 1.7;
  font-size: 15px;
}

.cc-doc-link {
  position: relative;
  overflow: hidden;
  min-width: 160px;
  padding: 14px 20px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1e40af, #2563eb);
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.cc-doc-link::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: skewX(-20deg);
  animation: shimmerBtn 3s infinite;
}

.cc-doc-link:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 12px 24px -8px rgba(37, 99, 235, 0.5);
}

.cc-doc-link svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.tutorial-guide {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin: 0 0 24px;
}

.guide-step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.guide-step:hover {
  transform: translateY(-6px);
  border-color: #93c5fd;
  background: #fff;
  box-shadow: 0 16px 40px -16px rgba(37, 99, 235, 0.15);
}

.guide-index {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #1e293b;
  color: #fff;
  font-family: var(--font-mono);
  font-weight: 800;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.guide-step:hover .guide-index {
  background: #2563eb;
  transform: scale(1.15) rotate(5deg);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.guide-step h3 {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.guide-step p {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.65;
}

.guide-step ul {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.guide-step li {
  position: relative;
  padding-left: 16px;
  color: #475569;
  font-size: 13.5px;
  line-height: 1.55;
}

.guide-step li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.7em;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3b82f6;
  transition: transform 0.2s;
}

.guide-step:hover li::before {
  transform: scale(1.3);
}

.cc-field-card,
.cc-tool-map,
.cc-details {
  margin-top: 24px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  transition: all 0.4s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.cc-field-card:hover,
.cc-tool-map:hover {
  box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
  border-color: #cbd5e1;
}

.cc-checks {
  padding: 0;
  border: none;
  background: transparent;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 24px;
}

.cc-field-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
}

.cc-field-head h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 900;
}

.cc-field-head span {
  color: var(--text-muted);
  font-size: 13px;
}

.cc-fields {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.cc-fields div {
  display: flex;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #f8fafc;
  transition: all 0.3s;
}

.cc-fields div:hover {
  background: #fff;
  border-color: #93c5fd;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.05);
}

.cc-fields span {
  color: #64748b;
  font-size: 13.5px;
  font-weight: 600;
}

.cc-fields b {
  font-family: var(--font-mono);
  font-size: 13.5px;
  text-align: right;
  word-break: break-all;
  color: #0f172a;
}

.tool-map-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.tool-map-grid div {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #eef2f7;
  background: #f8fafc;
  transition: all 0.3s;
}

.tool-map-grid div:hover {
  background: #fff;
  border-color: #cbd5e1;
  transform: translateY(-3px);
  box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.1);
}

.tool-map-grid b {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
}

.tool-map-grid span {
  color: #475569;
  font-size: 13.5px;
  line-height: 1.65;
}

.cc-checks div {
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(22, 163, 74, 0.02);
}

.cc-checks div:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -10px rgba(22, 163, 74, 0.15);
  border-color: #86efac;
}

.cc-checks b {
  display: block;
  margin-bottom: 8px;
  color: #15803d;
  font-size: 14px;
  font-weight: 800;
}

.cc-checks span {
  color: #166534;
  font-size: 13.5px;
  line-height: 1.6;
  display: block;
}

.cc-details {
  padding: 0;
  overflow: hidden;
}

.cc-details summary {
  padding: 16px 20px;
  font-weight: 800;
  cursor: pointer;
  background: #f8fafc;
  border-bottom: 1px solid transparent;
  transition: background 0.2s;
}

.cc-details[open] summary {
  border-bottom-color: var(--line);
}

.cc-details summary:hover {
  background: #f1f5f9;
}

.cc-details :deep(.code-card) {
  margin: 20px;
}

.guide-notes {
  display: grid;
  gap: 12px;
  margin-top: 24px;
}

.guide-notes div {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 10px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  transition: transform 0.3s;
}

.guide-notes div:hover {
  transform: translateX(6px);
  border-color: #bfdbfe;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.05);
}

.guide-notes b {
  color: #1d4ed8;
  font-size: 14px;
  font-weight: 800;
}

.guide-notes span {
  color: #334155;
  font-size: 13.5px;
  line-height: 1.6;
}

.warn {
  background: linear-gradient(135deg, #fffbeb, #fefce8);
  border: 1px solid var(--warn-border);
  padding: 18px 24px;
  border-radius: 12px;
  color: var(--warn-text);
  font-size: 14.5px;
  line-height: 1.65;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 6px rgba(253, 230, 138, 0.1);
}

.warn:hover {
  transform: translateY(-4px) scale(1.01);
  border-color: #fbbf24;
  box-shadow: 0 12px 30px -10px rgba(245, 158, 11, 0.25);
}

.inline-code {
  background: #fef3c7;
  border: 1px solid #fde68a;
  padding: 2px 7px;
  border-radius: 5px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: #92400e;
  font-weight: 600;
}

:deep(.code-card) {
  position: relative;
  border-radius: 12px;
  background: #0d1117;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}

:deep(.code-card:hover) {
  transform: translateY(-6px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
}

:deep(.code-head) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  color: #9ca3af;
  font-size: 13px;
  font-family: var(--font-mono);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  position: relative;
  font-weight: 600;
}

:deep(.code-head::before) {
  content: "";
  position: absolute;
  left: 16px;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 18px 0 0 #eab308, 36px 0 0 #22c55e;
  transform: translateY(-50%);
  transition: transform 0.3s;
}

:deep(.code-card:hover .code-head::before) {
  transform: translateY(-50%) scale(1.2);
}

:deep(pre) {
  margin: 0;
  padding: 24px;
  color: #e2e8f0;
  font-size: 13.5px;
  line-height: 1.75;
  font-family: var(--font-mono);
  overflow-x: auto;
  white-space: pre-wrap;
}

:deep(.copy-btn) {
  position: absolute;
  right: 12px;
  top: 8px;
  z-index: 2;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  color: #9ca3af;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

:deep(.copy-btn:hover) {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:deep(.copy-btn.copied) {
  background: #22c55e;
  color: #fff;
  border-color: #22c55e;
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
}

/* 全新 Chat Section (Flat 2.5D Style) */
.chat-section {
  margin-bottom: 40px;
  padding: 100px 0 60px;
  margin-top: 80px;
  border-top: 1px solid var(--line);
  text-align: center;
}

.chat-section .section-head {
  margin-bottom: 30px;
}

.mono-strong {
  font-family: var(--font-mono);
  font-weight: 700;
  color: #111;
  background: #f0f0f0;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 0.92em;
  border: 1px solid #d0d0d0;
}

.chat-showcase-card {
  max-width: 1040px;
  margin: 0 auto;
  padding: 40px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 30px 60px -20px rgba(15, 23, 42, 0.1);
  position: relative;
}

.chat-showcase-inner {
  position: relative;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
}

.chat-browser-frame {
  width: calc(100% - 140px);
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.1);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.browser-bar {
  height: 40px;
  background: #f8fafc;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  position: relative;
}

.window-dots {
  position: absolute;
  left: 16px;
  display: inline-flex;
  gap: 6px;
}

.window-dots i {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.window-dots i:nth-child(1) {
  background: #fc5f57;
}

.window-dots i:nth-child(2) {
  background: #febc2e;
}

.window-dots i:nth-child(3) {
  background: #28c840;
}

.browser-url {
  color: #64748b;
  font-size: 12px;
  font-family: var(--font-mono);
}

.img-pc {
  display: block;
  width: 100%;
  max-height: 500px;
  object-fit: cover;
  object-position: top;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}

.chat-phone-frame {
  position: absolute;
  right: 0;
  bottom: -20px;
  width: 220px;
  padding: 18px 8px 10px;
  border-radius: 32px;
  background: #0f172a;
  border: 4px solid #1e293b;
  box-shadow: -15px 25px 50px -10px rgba(15, 23, 42, 0.3);
  z-index: 2;
}

.phone-speaker {
  position: absolute;
  top: 12px;
  left: 50%;
  width: 40px;
  height: 5px;
  border-radius: 999px;
  background: #334155;
  transform: translateX(-50%);
}

.img-mobile {
  display: block;
  width: 100%;
  border-radius: 18px;
  object-fit: cover;
  max-height: 460px;
  background: #fff;
}

.chat-benefits {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  max-width: 860px;
  margin: 32px auto 0;
}

.benefit-card {
  padding: 16px 20px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
  transition: transform 0.3s, background 0.3s;
}

.benefit-card:hover {
  transform: translateY(-2px);
  background: #fff;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.04);
  border-color: #cbd5e1;
}

.benefit-card b {
  color: #111;
  font-weight: 800;
  font-size: 14.5px;
}

.benefit-card span {
  color: #555;
  font-size: 14px;
}

.chat-actions {
  margin-top: 40px;
}

.chat-actions .btn-primary {
  padding: 14px 40px;
  font-size: 16px;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

/* Modals */
.modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: modalBackdropIn 0.26s ease both;
}

@keyframes modalBackdropIn {
  from {
    opacity: 0;
    backdrop-filter: blur(0);
  }

  to {
    opacity: 1;
    backdrop-filter: blur(12px);
  }
}

@keyframes modalFloatIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes rowSlideIn {
  from {
    opacity: 0;
    transform: translateX(-15px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1;
  cursor: default;
}

.modal-box {
  width: 100%;
  max-width: 680px;
  max-height: 80vh;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 32px 100px rgba(0, 0, 0, 0.22);
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  animation: modalFloatIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  overflow: hidden;
  transform-origin: center 56%;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px;
  border-bottom: 1px solid var(--line);
  background: #f9fafb;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.model-modal .modal-title::before {
  content: "✓";
  color: #10b981;
  font-weight: 900;
}

.modal-title span,
.modal-subtitle {
  display: inline;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f5f5f5;
  color: var(--text-dim);
  font-size: 26px;
  line-height: 1;
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #ebebeb;
  border-color: #c0c0c0;
  color: var(--text-main);
  transform: rotate(90deg) scale(1.15);
}

.modal-close:active {
  transform: scale(0.85);
}

.table-header,
.model-item {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px 24px;
}

.table-header {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  background: #f9fafb;
  border-bottom: 1px solid var(--line);
}

.modal-body {
  padding: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

.model-item {
  border-bottom: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 14px;
  opacity: 0;
  animation: rowSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  transition: all 0.2s ease;
  border-top: 0;
}

.model-item:nth-child(1) {
  animation-delay: 0.05s;
}

.model-item:nth-child(2) {
  animation-delay: 0.1s;
}

.model-item:nth-child(3) {
  animation-delay: 0.15s;
}

.model-item:nth-child(4) {
  animation-delay: 0.2s;
}

.model-item:nth-child(5) {
  animation-delay: 0.25s;
}

.model-item:nth-child(6) {
  animation-delay: 0.3s;
}

.model-item:nth-child(7) {
  animation-delay: 0.35s;
}

.model-item:nth-child(8) {
  animation-delay: 0.4s;
}

.model-item:nth-child(9) {
  animation-delay: 0.45s;
}

.model-item:nth-child(10) {
  animation-delay: 0.5s;
}

.model-item:nth-child(n+11) {
  animation-delay: 0.55s;
}

.model-item:last-child {
  border-bottom: none;
}

.model-item:hover {
  background: #f8fafc;
  padding-left: 36px;
  border-left: 4px solid var(--text-main);
}

.model-item:active {
  transform: scale(0.99);
}

.tag-group {
  display: flex;
  gap: 8px;
}

.tag {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-family: var(--font-sans);
  font-weight: 600;
  border: 1px solid transparent;
  transition: transform 0.2s;
}

.model-item:hover .tag {
  transform: scale(1.08);
}

.tag-gray {
  background: #f3f4f6;
  color: #4b5563;
  border-color: #e5e7eb;
}

.tag-blue {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
}

.tag-orange {
  background: #fff7ed;
  color: #ea580c;
  border-color: #ffedd5;
}

.tag-purple {
  background: #fdf4ff;
  color: #c026d3;
  border-color: #f5d0fe;
}

.tag-green {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f0fdf4;
  color: #16a34a;
  border-color: #bbf7d0;
}

.tag-green::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #16a34a;
  border-radius: 50%;
  animation: dotPulse 2s infinite;
}

/* Checkout Modal Forms */
.checkout-box {
  width: min(560px, 100%);
  overflow: auto;
  scrollbar-gutter: stable;
}

.checkout-form,
.payment-panel,
.success-panel {
  padding: 24px;
}

.field {
  display: grid;
  gap: 7px;
  margin-bottom: 16px;
}

.field span {
  color: #374151;
  font-size: 13.5px;
  font-weight: 700;
}

.field input,
.field select {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  background: #fff;
  font-size: 14px;
  transition: border-color 0.18s, box-shadow 0.18s;
  outline: none;
  color: var(--text-main);
}

.field input:focus,
.field select:focus {
  border-color: #111;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
}

.field input::placeholder {
  color: #aaa;
}

.login-hint {
  margin: -4px 0 16px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  background: #f5f5f5;
  color: #333;
  font-size: 13px;
  line-height: 1.55;
}

.order-summary {
  display: grid;
  gap: 8px;
  padding: 16px;
  margin: 18px 0;
  border-radius: 10px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
}

.order-summary div,
.credential-box div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  font-size: 14px;
}

.recharge-rate-line {
  margin: 2px 0 0;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
  color: var(--text-muted);
  font-size: 12.5px;
  line-height: 1.5;
}

.order-summary span,
.credential-box span {
  color: var(--text-muted);
}

.order-summary b,
.credential-box b {
  text-align: right;
  word-break: break-all;
  color: var(--text-main);
}

.error-text {
  padding: 12px 16px;
  border-radius: 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  font-size: 13.5px;
  line-height: 1.55;
  margin-bottom: 12px;
}

.catalog-error {
  text-align: center;
  margin-bottom: 20px;
}

.catalog-loading {
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  padding: 40px 0;
}

.checkout-submit,
.pay-link {
  width: 100%;
}

.payment-actions {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  gap: 10px;
}

.payment-actions .btn {
  min-width: 0;
  width: 100%;
}

.payment-actions+.checkout-submit {
  margin-top: 12px;
}

.pay-status {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 10px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  margin-bottom: 4px;
}

.pay-status>div {
  flex: 1;
  min-width: 0;
}

.pay-status h4 {
  margin: 0 0 3px;
  font-size: 17px;
  font-weight: 800;
}

.pay-status p {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.status-dot {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #111;
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.1);
  animation: softPulse 2s infinite;
}

.pay-countdown {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 999px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #c2410c;
  font-size: 12px;
  font-weight: 800;
  font-family: var(--font-mono);
}

.qr-wrap {
  display: flex;
  justify-content: center;
  padding: 20px 0 12px;
}

.qr-wrap img {
  width: 240px;
  height: 240px;
  border-radius: 12px;
  border: 1px solid var(--line);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
}

.success-panel {
  text-align: center;
}

.success-mark {
  width: 68px;
  height: 68px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #111;
  color: #fff;
  font-size: 32px;
  font-weight: 900;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.success-panel h3 {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 800;
}

.success-panel p {
  margin: 0 auto 20px;
  color: var(--text-muted);
  line-height: 1.65;
  font-size: 14px;
}

.credential-box {
  display: grid;
  gap: 10px;
  padding: 16px;
  margin-bottom: 20px;
  border-radius: 10px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  text-align: left;
}

.success-actions {
  display: flex;
  gap: 10px;
}

.success-actions .btn {
  flex: 1;
}

/* Responsive */
@media (max-width: 900px) {
  .features {
    grid-template-columns: repeat(2, 1fr);
  }

  .cc-hero,
  .cc-field-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .tutorial-guide,
  .cc-checks,
  .cc-fields,
  .tool-map-grid {
    grid-template-columns: 1fr;
  }

  .chat-showcase-card {
    padding: 20px;
  }

  .chat-showcase-inner {
    flex-direction: column;
    align-items: center;
  }

  .chat-browser-frame {
    width: 100%;
  }

  .chat-phone-frame {
    position: relative;
    bottom: 0;
    right: 0;
    margin-top: -60px;
  }

  .chat-benefits {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {

  .topbar-inner,
  .wrap {
    padding-left: 16px;
    padding-right: 16px;
  }

  .nav {
    gap: 18px;
  }

  .title {
    font-size: 40px;
  }

  .features {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    flex-direction: column;
  }

  .price-card,
  .balance-more-card {
    min-width: 100%;
  }

  .table-header,
  .model-item {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 16px;
  }

  .model-item:hover {
    padding-left: 20px;
    border-left-width: 2px;
  }

  .modal {
    padding: 12px;
    align-items: flex-end;
  }

  .modal-box {
    max-height: 92vh;
    border-radius: 8px;
  }

  .success-actions {
    flex-direction: column;
  }
}

:global(body.codex-modal-open) {
  overflow: hidden !important;
}

:global(*) {
  scrollbar-width: thin;
  scrollbar-color: #c7cbd1 transparent;
}

:global(*::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:global(*::-webkit-scrollbar-track) {
  background: transparent;
}

:global(*::-webkit-scrollbar-thumb) {
  background: #c7cbd1;
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: content-box;
}

:global(*::-webkit-scrollbar-thumb:hover) {
  background: #8f959e;
  background-clip: content-box;
}

:global(*::-webkit-scrollbar-corner) {
  background: transparent;
}
</style>
