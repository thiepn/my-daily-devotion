import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";

export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="visual-screen" role="alert"><p className="eyebrow">Something went wrong</p><h1>Couldn’t open this page.</h1><p>Your saved data is still on this device. Reload to try again.</p><button className="quiet-button" type="button" onClick={() => window.location.reload()}>Reload MDD</button><Link className="quiet-back-link" to="/today">Return to Today</Link></main>;
  }
}
