import React, { Component } from "react";
import Book from "./Book";

class Booklist extends Component {
  constructor(props) {
    super(props);

    this.state = {
      books: [
        {
          id: 1,
          img:
            "https://images-na.ssl-images-amazon.com/images/I/91m8bgtiZnL._AC_SR201,266_.jpg",
          title: "Magic Hour: A Novel",
          author: "Ali Hamza"
        },
        {
          id: 2,
          img:
            "https://images-na.ssl-images-amazon.com/images/I/915L5zUTrWL.__SL440_PJku-sticker-v7,TopRight,0,-44AC_SR201,266_OU1_.jpg",
          title: "A Killer's Mind",
          author: "Umer Farooq"
        },
        {
          id: 3,
          img:
            "https://images-na.ssl-images-amazon.com/images/I/915L5zUTrWL.__SL440_PJku-sticker-v7,TopRight,0,-44AC_SR201,266_OU1_.jpg",
          title: "I Am Watching You",
          author: "Junaid Ansar"
        }
      ]
    };
  }
  filterDate = id => {
    console.log(id);

    const sortedDate = this.state.books.filter(item => item.id !== id);
    this.setState({
      books: sortedDate
    });
  };
  // handleClick = () => {
  //   console.log(`I am information from Parent Booklist Container`);
  // };
  render() {
    return (
      <React.Fragment>
        <h2>Best selling Book in this week </h2>
        {this.state.books.map(item => {
          return (
            <Book key={item.id} info={item} deleteitem={this.filterDate} />
          );
        })}
      </React.Fragment>
    );
  }
}

export default Booklist;
