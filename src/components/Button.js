import React, { Component } from "react";
class Button extends Component {
  render() {
    const { handleClick } = this.props;
    return (
      <button
        style={{ background: "red", color: "white", fontSize: "1.5rem" }}
        onClick={handleClick}
      >
        I'm lower button
      </button>
    );
  }
}

export default Button;
