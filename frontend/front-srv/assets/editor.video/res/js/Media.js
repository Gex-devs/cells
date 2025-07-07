import React from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import cx from "classnames";
import Hls from "hls.js";
import _ from "lodash";

const DEFAULT_HEIGHT = "100%";
const DEFAULT_WIDTH = "100%";
const DEFAULT_ASPECT_RATIO = 9 / 16;
const DEFAULT_ADJUSTED_SIZE = 0;
const DEFAULT_RESIZE_DEBOUNCE_TIME = 500;
const DEFAULT_DOMAIN = "https://minecraft.ged-home.space/";

const DEFAULT_VIDEO_OPTIONS = {
  preload: "auto",
  autoplay: false,
  controls: true,
};

function noop() {}
class Media extends React.Component {
  static get styles() {
    return {
      container: {
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      },
      video: {
        flex: 1,
      },
    };
  }

  constructor(props) {
    super(props);
    this.videoRef = React.createRef();
    this.handleVideoPlayerResize = this.handleVideoPlayerResize.bind(this);
    this.getResizedVideoPlayerMeasurements =
      this.getResizedVideoPlayerMeasurements.bind(this);
  }

  componentDidMount() {
    this.mountHlsPlayer();
    if (this.props.resize) {
      this.handleVideoPlayerResize();
      this.addResizeEventListener();
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.src !== this.props.src) {
      this.reloadSource(this.props.src);
    }
  }

  componentWillUnmount() {
    this.cleanupPlayer();
    this.removeResizeEventListener();
  }

  async mountHlsPlayer() {
    const video = this.videoRef.current;
    const { src, onReady, eventListeners } = this.props;
    console.log(src);
    // let thejson = JSON.stringify({ theinput: src });
    let newsrc = await (await fetch(DEFAULT_DOMAIN + "video?input=" + encodeURIComponent(src))).text();

    console.log("src: ", newsrc);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        if (this.props.options?.autoplay) video.play();
        onReady();
      });
    } else if (Hls.isSupported()) {
      this.hls = new Hls();
      this.hls.loadSource("https://minecraft.ged-home.space" + newsrc);
      this.hls.attachMedia(video);

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (this.props.options?.autoplay) video.play();
        onReady();
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS.js error:", data);
      });

      // Bind custom listeners
      _.forEach(eventListeners, (handler, key) => {
        this.hls.on(key, handler);
      });
    } else {
      console.error("HLS not supported in this browser");
    }

    if (this.props.endlessMode) {
      video.addEventListener("ended", this.props.onNextVideo);
    }
  }

  reloadSource(newSrc) {
    if (this.hls) {
      this.hls.detachMedia();
      this.hls.loadSource(newSrc);
      this.hls.attachMedia(this.videoRef.current);
    } else if (
      this.videoRef.current.canPlayType("application/vnd.apple.mpegurl")
    ) {
      this.videoRef.current.src = newSrc;
    }
  }

  cleanupPlayer() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    const video = this.videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  }

  addResizeEventListener() {
    const debounceTime = this.getVideoResizeOptions().debounceTime;
    this._handleResize = _.debounce(this.handleVideoPlayerResize, debounceTime);
    window.addEventListener("resize", this._handleResize);
  }

  removeResizeEventListener() {
    if (this._handleResize) {
      window.removeEventListener("resize", this._handleResize);
    }
  }

  handleVideoPlayerResize() {
    const video = this.videoRef.current;
    if (!video) return;
    const { width, height } = this.getResizedVideoPlayerMeasurements();
    video.style.width = `${width}px`;
    video.style.height = `${height}px`;
  }

  getVideoResizeOptions() {
    return _.defaults({}, this.props.resizeOptions, {
      aspectRatio: DEFAULT_ASPECT_RATIO,
      shortWindowVideoHeightAdjustment: DEFAULT_ADJUSTED_SIZE,
      defaultVideoWidthAdjustment: DEFAULT_ADJUSTED_SIZE,
      debounceTime: DEFAULT_RESIZE_DEBOUNCE_TIME,
    });
  }

  getResizedVideoPlayerMeasurements() {
    const {
      aspectRatio,
      shortWindowVideoHeightAdjustment,
      defaultVideoWidthAdjustment,
    } = this.getVideoResizeOptions();
    const winHeight = window.innerHeight;
    const baseWidth = this.videoRef.current?.parentElement?.offsetWidth || 640;
    const vidWidth = baseWidth - defaultVideoWidthAdjustment;
    let vidHeight = vidWidth * aspectRatio;
    if (winHeight < vidHeight) {
      vidHeight = winHeight - shortWindowVideoHeightAdjustment;
    }
    return { width: vidWidth, height: vidHeight };
  }

  renderDefaultWarning() {
    return (
      <p className="vjs-no-js">
        <a
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noreferrer"
        >
          Your browser is too old. Please update to a modern browser to view
          this video.
        </a>
      </p>
    );
  }

  render() {
    const videoPlayerClasses = cx({
      "vjs-default-skin": this.props.vjsDefaultSkin,
      "vjs-big-play-centered": this.props.vjsBigPlayCentered,
    });

    const { controls, preload } = this.props.options || DEFAULT_VIDEO_OPTIONS;

    return (
      <div style={Media.styles.container}>
        <video
          ref={this.videoRef}
          className={videoPlayerClasses}
          style={Media.styles.video}
          controls={controls}
          preload={preload}
        >
          {this.props.children || this.renderDefaultWarning()}
        </video>
      </div>
    );
  }
}

Media.defaultProps = {
  endlessMode: false,
  options: DEFAULT_VIDEO_OPTIONS,
  onReady: noop,
  eventListeners: {},
  resize: false,
  resizeOptions: {},
  vjsDefaultSkin: true,
  vjsBigPlayCentered: true,
  onNextVideo: noop,
};

Media.propTypes = {
  src: PropTypes.string.isRequired,
  poster: PropTypes.string,
  height: PropTypes.number,
  width: PropTypes.number,
  endlessMode: PropTypes.bool,
  options: PropTypes.object,
  onReady: PropTypes.func,
  eventListeners: PropTypes.object,
  resize: PropTypes.bool,
  resizeOptions: PropTypes.shape({
    aspectRatio: PropTypes.number,
    shortWindowVideoHeightAdjustment: PropTypes.number,
    defaultVideoWidthAdjustment: PropTypes.number,
    debounceTime: PropTypes.number,
  }),
  vjsDefaultSkin: PropTypes.bool,
  vjsBigPlayCentered: PropTypes.bool,
  children: PropTypes.element,
  onNextVideo: PropTypes.func,
};

export default Media;
