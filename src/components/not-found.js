import asciiVideo from '../assets/ascii-animation (1).mp4'

export const html = `
<!-- CRT barrel-warp filter. Same feDisplacementMap technique as the services
     liquid-lens: a displacement map that is neutral gray (no shift) in the
     centre and ramps to the directional R/G gradients toward the edges. The
     centre therefore stays crisp (the 404 type reads sharp) while the edges bow
     outward like a CRT tube. Tune the feDisplacementMap scale to dial warp
     intensity; swap the gradient stop colours to flip convex vs concave. -->
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
  <defs>
    <filter id="crt-warp" x="-16%" y="-16%" width="132%" height="132%" color-interpolation-filters="sRGB">
      <feImage x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="map"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cdefs%3E%3ClinearGradient id='gx' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23000000'/%3E%3Cstop offset='1' stop-color='%23ff0000'/%3E%3C/linearGradient%3E%3ClinearGradient id='gy' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23000000'/%3E%3Cstop offset='1' stop-color='%2300ff00'/%3E%3C/linearGradient%3E%3CradialGradient id='gc' cx='0.5' cy='0.5' r='0.5'%3E%3Cstop offset='0' stop-color='%237f7f7f'/%3E%3Cstop offset='0.35' stop-color='%237f7f7f'/%3E%3Cstop offset='1' stop-color='%237f7f7f' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='120' height='120' fill='url(%23gx)'/%3E%3Crect width='120' height='120' fill='url(%23gy)' style='mix-blend-mode:screen'/%3E%3Crect width='120' height='120' fill='url(%23gc)'/%3E%3C/svg%3E"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="60" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
</svg>

<section class="nf-stage">
  <div class="nf-screen">
    <video class="nf-video" autoplay muted loop playsinline preload="auto">
      <source src="${asciiVideo}" type="video/mp4" />
    </video>

    <div class="nf-scanlines" aria-hidden="true"></div>
    <div class="nf-vignette" aria-hidden="true"></div>
    <div class="nf-scrim" aria-hidden="true"></div>

    <div class="nf-content">
      <h1 class="nf-code">404</h1>
      <p class="nf-label">Not Found</p>
      <a href="/" class="nf-btn">
        Take me back
        <svg class="nf-btn__arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M11 5 5 11M5 11h5M5 11V6" stroke="currentColor" stroke-width="1.6"
            stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    </div>
  </div>
</section>
`

export function init() {
  // Autoplay can be blocked until the asset is ready; nudge it once metadata lands.
  const video = document.querySelector('.nf-video')
  if (!video) return
  const play = () => video.play().catch(() => {})
  if (video.readyState >= 2) play()
  else video.addEventListener('loadeddata', play, { once: true })
}
