import io
import pandas as pd

class ColumnTranslator:
    def __init__(self, all_columns: list[tuple[str,bool]]):
        self.all_columns = all_columns

    @property
    def kept_columns(self) -> list[str]:
        """
        Get the columns that were not omitted.

        Returns:
            list[str]: A list of column names that were not omitted.
        """
        return [column for column, omitted in self.all_columns if not omitted]

    def strip(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Strip human columns from a DataFrame.

        Args:
            df (DataFrame): A DataFrame with human columns.

        Returns:
            DataFrame: A DataFrame without human columns.
        """
        return df.drop(columns=[column for column, omitted in self.all_columns if omitted])

    def reconstitute(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Reconstitute the omitted human columns in a DataFrame with empty values.

        Args:
            df (DataFrame): A DataFrame without human columns.

        Returns:
            DataFrame: A DataFrame with human columns.
        """
        columns = {}
        for column, omitted in self.all_columns:
            if omitted:
                columns[column] = [''] * len(df)
            else:
                columns[column] = df[column]
        return pd.DataFrame(columns)

def to_df(data) -> pd.DataFrame:
    """
    Convert a CSV string to a pandas DataFrame.
    If it's already a DataFrame, return it as is.
    """
    if isinstance(data, pd.DataFrame):
        return data
    else:
        csv_data = io.StringIO(data)
        return pd.read_csv(csv_data)

def is_human_column(column: str) -> bool:
    """
    Check if a column is a human column.

    Args:
        column (str): The column name to check.

    Returns:
        bool: True if the column is a human column, False otherwise.
    """
    return 'human' in column.lower() or 'model_eval' in column.lower()

def remove_human_columns_df(data) -> tuple[pd.DataFrame, ColumnTranslator]:
    """
    Remove human columns from a pandas DataFrame.

    Args:
        data (DataFrame): A pandas DataFrame or bytes/str containing the CSV.

    Returns:
        tuple[str, ColumnTranslator]: A tuple containing the DataFrame without human columns
        and a ColumnTranslator object for reconsituting them afterwards.
    """
    df = to_df(data)
    all_columns = [(column, is_human_column(column)) for column in df.columns]
    translator = ColumnTranslator(all_columns)
    stripped = translator.strip(df)
    return stripped, translator

def remove_human_columns(data) -> tuple[str, ColumnTranslator]:
    """
    Remove human columns from a pandas DataFrame.

    Args:
        data (DataFrame): A pandas DataFrame or bytes/str containing the CSV.

    Returns:
        tuple[str, ColumnTranslator]: A tuple containing the CSV string of the DataFrame without human columns
        and a ColumnTranslator object for reconsituting them afterwards.
    """
    stripped, translator = remove_human_columns_df(data)
    return stripped.to_csv(index=False, header=True), translator

def read_llm_csv_output(output: str, expected_columns: list[str], index=None) -> pd.DataFrame:
    """
    Read the output of an LLM model in CSV format and return a DataFrame.

    Args:
        output (str): The output of the LLM model in CSV format.
        expected_columns (list[str]): The expected columns in the output.

    Returns:
        DataFrame: A DataFrame containing the output data.
    """
    expected_header = ','.join(expected_columns) + '\n'
    if output.startswith(expected_header):
        output = output[len(expected_header):]
    df = pd.read_csv(io.StringIO(output.strip()), header=None, names=expected_columns, on_bad_lines='warn')
    if index is not None:
        df.index = index
    return df

def find_dodgy_rows(df: pd.DataFrame) -> pd.Series:
    """
    Find the rows in a DataFrame that contain dodgy data.

    Args:
        df (DataFrame): A DataFrame with dodgy data.
    """
    if 'human' in df.columns:
        return df['human'] == 'incorrect'
    else:
        raise ValueError("No 'human' column found in the DataFrame.")