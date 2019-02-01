import React, { Component } from "react";
// import Button from "./Button";

class Book extends Component {
  constructor(props) {
    super(props);
    //  In State the method need to bind When the method is called in the events
    // this.handleClick = this.handleClick.bind(this);
    this.state = {
      count: 0,
      showInfo: true
    };
  }

  handleInfo = () => {
    this.setState({
      showInfo: !this.state.showInfo
    });
  };

  //    Events clcik
  //  Old ES5 Ways
  // handleClick() {
  //   console.log("You can click me");
  //   console.log(this.state.count);
  // }

  // handleClick = () => {
  //   this.setState({
  //     count: this.state.count + 1
  //   });
  // };

  // deceaseCount = () => {
  //   this.setState({
  //     count: this.state.count - 1
  //   });
  // };

  // ResetCount = () => {
  //   this.setState({
  //     count: 0
  //   });
  // };

  render() {
    const { id, title, author, img } = this.props.info;
    // Parsing the method using props
    // const { handleClick } = this.props;
    const { deleteitem } = this.props;
    const checkInfo = info => {
      if (info === true) {
        return (
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Nemo
            excepturi nihil quam ipsum cupiditate at!
          </p>
        );
      } else {
        return null;
      }
    };
    return (
      <div className="book">
        <img src={img} width="150px" alt="" />
        <div>
          <h4>{title}</h4>
          <h5>{author}</h5>
          {/* <button onClick={this.handleClick}>Add Ccount </button>
          <button onClick={this.deceaseCount}>decrease Count </button>
          <button onClick={this.ResetCount}>Reset count</button>
          <h1>Count: {this.state.count}</h1>
          <Button handleClick={handleClick} /> */}
          <button onClick={() => deleteitem(id)}>Delete item</button>
          <button onClick={this.handleInfo}>Show info</button>
          {/* {this.state.showInfo ? (
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Error,
              perferendis!
            </p>
          ) : null} */}
          {/* {this.state.showInfo && (
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Error,
              perferendis!
            </p>
          )} */}

          {checkInfo(this.state.showInfo)}
        </div>
      </div>
    );
  }
}
export default Book;
