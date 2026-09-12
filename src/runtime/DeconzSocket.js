import EventEmitter from "events";

class DeconzSocket extends EventEmitter {
  constructor({
    hostname,
    port = 443,
    token,
    secure = false,
    reconnectInterval = 10000,
    reconnectMaxRetries = Infinity,
    autoConnect = true,
  } = {}) {
    super();

    this.hostname = hostname;
    this.port = port;
    this.token = token;
    this.secure = secure;
    this.reconnectInterval = reconnectInterval;
    this.reconnectMaxRetries = reconnectMaxRetries;
    this.autoConnect = autoConnect;

    this.shouldClose = false;
    this.retries = 0;
    this.socket = null;

    if (this.autoConnect) {
      this.connect();
    }
  }

  buildAddress() {
    const protocol = this.secure ? "wss" : "ws";
    return `${protocol}://${this.hostname}:${this.port}`;
  }

  connect() {
    if (this.retries++ >= this.reconnectMaxRetries) {
      this.emit("reconnect-max-retries", this.reconnectMaxRetries);
    }

    try {
      this.socket = new WebSocket(this.buildAddress());
    } catch (err) {
      this.onClose(err);
      throw err;
    }

    this.socket.addEventListener("open", (event) => this.onOpen(event));
    this.socket.addEventListener("message", (event) => this.onMessage(event));
    this.socket.addEventListener("error", (err) => this.onError(err));
    this.socket.addEventListener("close", (event) =>
      this.onClose(event.code, event.reason)
    );
  }

  close() {
    this.shouldClose = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  parseData(data) {
    try {
      return JSON.parse(data);
    } catch (err) {
      this.emit("error", err);
      return null;
    }
  }

  get isReady() {
    return (
      this.socket &&
      this.socket.readyState === WebSocket.OPEN &&
      !this.shouldClose
    );
  }

  onOpen(event) {
    this.retries = 0;
    this.emit("open", event);
  }

  onClose(code, reason) {
    if (!this.shouldClose) {
      setTimeout(() => this.connect(), this.reconnectInterval);
    }

    this.emit("close", code, reason);
  }

  onMessage(event) {
    const payload = this.parseData(event.data);
    if (payload) {
      this.emit("message", payload);
    }
  }

  onError(err) {
    this.emit("error", err);
  }
}

export default DeconzSocket;
